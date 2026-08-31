import { Router } from "express";
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { parsePagination, paginatedResponse } from "../pagination.js";
import { NotFoundError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import { treeCreateSchema, treeUpdateSchema } from "../validation/schemas.js";
import { sendCsv, sendExcel } from "../export.js";
import { TREE_EXPORT_COLUMNS } from "../exportColumns.js";

export const treeRouter = Router();
treeRouter.use(requireAuth);

// 地図のbboxスコープ取得(最小限のフィールドのみ)。一覧より先に定義し、
// Expressのルートマッチング順序で "/:id" に食われないようにする。
treeRouter.get("/map", async (req, res) => {
  const filter = (await checkPermissionAndGetFilter("tree", "read", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const { swLat, swLng, neLat, neLng } = req.query as Record<string, string>;

  const bboxFilter: Prisma.TreeWhereInput =
    swLat && swLng && neLat && neLng
      ? {
          latitude: { gte: Number(swLat), lte: Number(neLat) },
          longitude: { gte: Number(swLng), lte: Number(neLng) },
        }
      : {};

  const where: Prisma.TreeWhereInput = { deletedAt: null, ...filter, ...bboxFilter };
  const trees = await prisma.tree.findMany({
    where,
    select: { id: true, treeNumber: true, latitude: true, longitude: true, healthStatus: true },
  });
  res.json({ data: trees });
});

async function buildTreeListWhere(req: Request) {
  const filter = (await checkPermissionAndGetFilter("tree", "read", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const { status, healthStatus, species, address, q } = req.query as Record<string, string>;

  const where: Prisma.TreeWhereInput = {
    deletedAt: null,
    ...filter,
    ...(status ? { status: status as Prisma.EnumTreeStatusFilter } : {}),
    ...(healthStatus
      ? { healthStatus: healthStatus as Prisma.EnumHealthStatusNullableFilter }
      : {}),
    ...(species ? { species: { contains: species, mode: "insensitive" } } : {}),
    ...(address ? { address: { contains: address, mode: "insensitive" } } : {}),
    ...(q ? { treeNumber: { contains: q, mode: "insensitive" } } : {}),
  };
  return where;
}

treeRouter.get("/", async (req, res) => {
  const where = await buildTreeListWhere(req);
  const { skip, take, page, pageSize } = parsePagination(req);

  const [data, total] = await Promise.all([
    prisma.tree.findMany({ where, skip, take, orderBy: { treeNumber: "asc" } }),
    prisma.tree.count({ where }),
  ]);
  res.json(paginatedResponse(data, total, page, pageSize));
});

// 機能要件#11(台帳のCSV/Excel出力)。一覧と同じ絞り込み条件をページングなしで対象にする。
// "/:id"より前に定義する必要がある("/map"と同じ理由)。
treeRouter.get("/export", async (req, res) => {
  const where = await buildTreeListWhere(req);
  const rows = await prisma.tree.findMany({ where, orderBy: { treeNumber: "asc" } });
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";
  if (format === "xlsx") {
    await sendExcel(res, "tree", "tree", TREE_EXPORT_COLUMNS, rows);
  } else {
    sendCsv(res, "tree", TREE_EXPORT_COLUMNS, rows);
  }
});

// 機能要件#20: 指定期間の樹木数量(樹種毎の本数、植樹本数、伐採本数)を集計する。
// "伐採日"という列は要件定義書上のTreeテーブルには存在しない(ステータス変更としてのみ
// 記録される)ため、伐採本数は監査ログ(AuditLog)上でstatus→"removed"に変わった
// UPDATE操作を期間集計することで代替する。"/:id"より前に定義する必要がある。
treeRouter.get("/stats", async (req, res) => {
  const filter = (await checkPermissionAndGetFilter("tree", "read", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const dateRange =
    dateFrom || dateTo
      ? {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(`${dateTo}T23:59:59.999`) : undefined,
        }
      : undefined;

  // 樹種別本数(現存する樹木のみ、期間の影響を受けないスナップショット)。
  const bySpeciesRaw = await prisma.tree.groupBy({
    by: ["species"],
    where: { deletedAt: null, status: { not: "removed" }, ...filter },
    _count: { _all: true },
  });
  const bySpecies = bySpeciesRaw
    .map((r) => ({ species: r.species ?? "(未設定)", count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  // 期間内の植樹本数(plantedDateが指定範囲内)。
  const plantedBySpeciesRaw = await prisma.tree.groupBy({
    by: ["species"],
    where: {
      deletedAt: null,
      ...filter,
      ...(dateRange ? { plantedDate: dateRange } : {}),
    },
    _count: { _all: true },
  });
  const plantedBySpecies = plantedBySpeciesRaw
    .map((r) => ({ species: r.species ?? "(未設定)", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const plantedCount = plantedBySpecies.reduce((sum, r) => sum + r.count, 0);

  // 期間内の伐採本数。エリアスコープのユーザーには担当エリア内の樹木のみを対象にする
  // (AuditLog自体はroute_number等のスコープ情報を持たないため、先にスコープ内の
  // 樹木idを絞り込んでからAuditLogのrecordIdで突き合わせる)。
  //
  // 監査ログのUPDATE 1行はその時点の行全体のスナップショット(after)であり、
  // 「このUPDATEでstatusが伐採済に変わった」ことまでは表さない。そのため単純に
  // diff.after.status === "removed" な行数を数えると、伐採後に備考等の別項目を
  // 編集しただけの行まで「伐採」として二重・多重カウントしてしまう。
  // 正しくは樹木ごとに「最初にstatusが伐採済になった時刻」を求め、その時刻が
  // 指定期間内かどうかで1本として数える必要がある。
  const auditWhere: Prisma.AuditLogWhereInput = { tableName: "Tree", action: "UPDATE" };
  if (filter) {
    const scopedIds = (await prisma.tree.findMany({ where: filter, select: { id: true } })).map(
      (t) => t.id
    );
    auditWhere.recordId = { in: scopedIds };
  }
  const allUpdateLogs = await prisma.auditLog.findMany({
    where: auditWhere,
    select: { recordId: true, changedAt: true, diff: true },
    orderBy: { changedAt: "asc" },
  });
  const firstRemovedAt = new Map<string, Date>();
  for (const log of allUpdateLogs) {
    const diff = log.diff as { after?: { status?: string } } | null;
    if (diff?.after?.status === "removed" && !firstRemovedAt.has(log.recordId)) {
      firstRemovedAt.set(log.recordId, log.changedAt);
    }
  }
  const removedCount = Array.from(firstRemovedAt.values()).filter((changedAt) => {
    if (dateRange?.gte && changedAt < dateRange.gte) return false;
    if (dateRange?.lte && changedAt > dateRange.lte) return false;
    return true;
  }).length;

  res.json({ bySpecies, plantedCount, plantedBySpecies, removedCount });
});

treeRouter.get("/:id", async (req, res) => {
  const filter = (await checkPermissionAndGetFilter("tree", "read", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const tree = await prisma.tree.findFirst({
    where: { id: String(req.params.id), deletedAt: null, ...filter },
  });
  if (!tree) throw new NotFoundError();
  res.json(tree);
});

treeRouter.post("/", async (req, res) => {
  await checkPermissionAndGetFilter("tree", "create", req.user!);
  const data = parseOrThrow(treeCreateSchema, req.body);
  const tree = await prisma.tree.create({ data: data as Prisma.TreeUncheckedCreateInput });
  res.status(201).json(tree);
});

treeRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const filter = (await checkPermissionAndGetFilter("tree", "update", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const existing = await prisma.tree.findFirst({ where: { id, deletedAt: null, ...filter } });
  if (!existing) throw new NotFoundError();
  const data = parseOrThrow(treeUpdateSchema, req.body);
  const tree = await prisma.tree.update({
    where: { id },
    data: data as Prisma.TreeUncheckedUpdateInput,
  });
  res.json(tree);
});

// ドラッグでの位置修正専用の狭いエンドポイント(#30/#31)。
// 更新権限があれば緯度経度だけを変更できる、権限チェックが単純な形にしている。
treeRouter.patch("/:id/location", async (req, res) => {
  const id = String(req.params.id);
  const filter = (await checkPermissionAndGetFilter("tree", "update", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    res.status(400).json({ error: "latitude/longitudeは数値で指定してください。" });
    return;
  }
  const existing = await prisma.tree.findFirst({ where: { id, deletedAt: null, ...filter } });
  if (!existing) throw new NotFoundError();
  const tree = await prisma.tree.update({ where: { id }, data: { latitude, longitude } });
  res.json(tree);
});

treeRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  const filter = (await checkPermissionAndGetFilter("tree", "delete", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const existing = await prisma.tree.findFirst({ where: { id, deletedAt: null, ...filter } });
  if (!existing) throw new NotFoundError();
  await prisma.tree.update({ where: { id }, data: { deletedAt: new Date() } });
  res.status(204).send();
});
