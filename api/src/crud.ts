import { Router } from "express";
import type { Request } from "express";
import type { ZodType } from "zod";
import type { Entity } from "./auth/rbac.js";
import { requireAuth } from "./auth/middleware.js";
import { checkPermissionAndGetFilter } from "./auth/scope.js";
import { parsePagination, paginatedResponse } from "./pagination.js";
import { NotFoundError } from "./errors.js";
import { parseOrThrow } from "./validation/parse.js";
import { sendCsv, sendExcel, type ExportColumn } from "./export.js";
import { prisma } from "./db.js";

// Prismaの各モデルデリゲート(prisma.tree, prisma.diagnosis等)はモデルごとに
// 異なる引数の生成型を持つため、共通インターフェースにまとめる時点で
// 具体的な型情報は失われる。ここは意図的にanyを許容し、実引数の妥当性は
// Prisma自体のランタイムバリデーションに委ねる設計にしている。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaDelegate = {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  // countはPrismaの拡張機能(監査ログ)適用後、型上はnumber | {}に広がるため
  // anyで受ける(実行時は常にnumberが返る)。
  count: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

type CrudRouterConfig = {
  entity: Entity;
  delegate: PrismaDelegate;
  orderBy: Record<string, "asc" | "desc">;
  // treeIdでの絞り込みを許可するか(diagnosis/inspection/workHistory等)
  treeIdFilter?: boolean;
  softDelete?: boolean; // 既定true。replant等も含め全ドメインテーブルがdeletedAtを持つ
  // 作成時に標準のdelegate.create(...)ではなく、この関数を使う。
  // 「植替え登録で旧樹木のステータスを自動更新する」のような、
  // 他テーブルへの副作用を伴う業務ロジック(Dataverse版でのPower Automate相当)を
  // トランザクション付きで差し込むための拡張点。
  onCreate?: (data: unknown) => Promise<unknown>;
  // onCreateと同様、更新時にPower Automate相当の副作用を挟むための拡張点。
  // 例: 樹木診断の総合判定を修正した場合、樹木マスタの健全度も追随させる。
  onUpdate?: (id: string, data: unknown, existing: unknown) => Promise<unknown>;
  // POST/PATCHのreq.bodyを検証するzodスキーマ。型・必須項目・余計なフィールドの
  // 混入(id/createdAt等)を弾く。全エンティティ共通で必須にし、指定漏れを防ぐ。
  createSchema: ZodType;
  updateSchema: ZodType;
  // 機能要件#11/#25(台帳・作業予定簿のCSV/Excel出力)。指定したエンティティのみ
  // GET /:entity/export?format=csv|xlsx を有効にする。ページングなしで全件対象。
  exportColumns?: ExportColumn[];
  // 機能要件#13(期間を指定して検索)。指定したPrismaフィールド名に対して
  // ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD で範囲検索できるようにする。
  dateFilterField?: string;
  // 機能要件#19(台帳の各項目ごとに絞込検索ができること)。列挙したフィールドのみ
  // ?<key>=<value> による絞り込みを許可する(未列挙のフィールド名はクエリに
  // 含まれていても無視する。任意のカラムを外部から指定させないためのホワイトリスト)。
  // text: 部分一致(大文字小文字区別なし) / select: 完全一致(enum) / checkbox: 真偽値。
  filterFields?: { key: string; mode: "text" | "select" | "checkbox" }[];
};

/**
 * 標準的なCRUD(一覧+ページング/取得/作成/更新/論理削除)を持つRouterを
 * 生成する。7エンティティで同じパターンを手書きすると差分バグが出やすいため、
 * ここに集約している。特殊なエンドポイント(地図bbox、位置修正専用PATCH等)は
 * 個別のルートファイル側で追加する。
 */
export function createCrudRouter(config: CrudRouterConfig): Router {
  const {
    entity,
    delegate,
    orderBy,
    treeIdFilter = false,
    softDelete = true,
    onCreate,
    onUpdate,
    createSchema,
    updateSchema,
    exportColumns,
    dateFilterField,
    filterFields,
  } = config;
  const router = Router();
  router.use(requireAuth);

  // 一覧(ページングあり)とエクスポート(全件)で同じ絞り込み条件を使うための共通処理。
  async function buildWhere(req: Request) {
    const filter = await checkPermissionAndGetFilter(entity, "read", req.user!);
    const treeId = treeIdFilter ? (req.query.treeId as string | undefined) : undefined;
    const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    const dateRange =
      dateFilterField && (dateFrom || dateTo)
        ? {
            [dateFilterField]: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
            },
          }
        : {};
    const fieldFilters: Record<string, unknown> = {};
    for (const f of filterFields ?? []) {
      const raw = req.query[f.key];
      if (typeof raw !== "string" || raw === "") continue;
      if (f.mode === "text") fieldFilters[f.key] = { contains: raw, mode: "insensitive" };
      else if (f.mode === "checkbox") fieldFilters[f.key] = raw === "true";
      else fieldFilters[f.key] = raw;
    }
    return {
      ...(softDelete ? { deletedAt: null } : {}),
      ...filter,
      ...(treeId ? { treeId } : {}),
      ...dateRange,
      ...fieldFilters,
    };
  }

  router.get("/", async (req, res) => {
    const where = await buildWhere(req);
    const { skip, take, page, pageSize } = parsePagination(req);

    const [data, total] = await Promise.all([
      delegate.findMany({ where, skip, take, orderBy }),
      delegate.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  });

  // "/export"は"/:id"より前に定義する必要がある(Expressのルートマッチング順で
  // "/:id"に"export"という文字列が食われてしまうため。tree.tsの"/map"と同じ理由)。
  if (exportColumns) {
    router.get("/export", async (req, res) => {
      const where = await buildWhere(req);
      const rows = await delegate.findMany({ where, orderBy });
      const format = req.query.format === "xlsx" ? "xlsx" : "csv";
      if (format === "xlsx") {
        await sendExcel(res, entity, entity, exportColumns, rows);
      } else {
        sendCsv(res, entity, exportColumns, rows);
      }
    });
  }

  router.get("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "read", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const record = await delegate.findFirst({ where });
    if (!record) throw new NotFoundError();
    res.json(record);
  });

  router.post("/", async (req, res) => {
    await checkPermissionAndGetFilter(entity, "create", req.user!);
    const data = parseOrThrow(createSchema, req.body);
    const record = onCreate ? await onCreate(data) : await delegate.create({ data });
    res.status(201).json(record);
  });

  router.patch("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "update", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const existing = await delegate.findFirst({ where });
    if (!existing) throw new NotFoundError();
    const data = parseOrThrow(updateSchema, req.body);
    const record = onUpdate
      ? await onUpdate(req.params.id, data, existing)
      : await delegate.update({ where: { id: req.params.id }, data });
    res.json(record);
  });

  router.delete("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "delete", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const existing = await delegate.findFirst({ where });
    if (!existing) throw new NotFoundError();
    if (softDelete) {
      await delegate.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).send();
  });

  return router;
}

export { prisma };
