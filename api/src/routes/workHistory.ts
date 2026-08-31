import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { createCrudRouter, prisma } from "../crud.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { NotFoundError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import {
  workHistoryCreateSchema,
  workHistoryPhotoCreateSchema,
  workHistoryUpdateSchema,
} from "../validation/schemas.js";
import { WORK_HISTORY_EXPORT_COLUMNS } from "../exportColumns.js";
import { sendTablePdf } from "../export.js";

const WORK_TYPE_LABELS: Record<string, string> = {
  pruning: "剪定",
  felling: "伐採",
  stumpRemoval: "伐根",
  stakeWork: "支柱設置撤去",
  fertilizing: "施肥",
  soilImprovement: "土壌改良",
  other: "その他",
};
const PERFORMER_TYPE_LABELS: Record<string, string> = { ward: "区", contractor: "委託業者" };

export const workHistoryRouter: Router = createCrudRouter({
  entity: "workHistory",
  delegate: prisma.workHistory,
  orderBy: { workDate: "desc" },
  treeIdFilter: true,
  createSchema: workHistoryCreateSchema,
  updateSchema: workHistoryUpdateSchema,
  exportColumns: WORK_HISTORY_EXPORT_COLUMNS,
  dateFilterField: "workDate",
  filterFields: [
    { key: "workNumber", mode: "text" },
    { key: "workType", mode: "select" },
    { key: "performerType", mode: "select" },
  ],
});

// 機能要件#25: 指定した期間の作業予定簿内訳を所定の様式でPDF出力する。
// 「予定」を管理する専用機能はまだ無いため、実績である作業履歴(WorkHistory)を
// 期間指定で様式化して出力する形で対応する。
workHistoryRouter.get("/export/pdf", requireAuth, async (req, res) => {
  const filter = (await checkPermissionAndGetFilter("workHistory", "read", req.user!)) as
    | Prisma.WorkHistoryWhereInput
    | undefined;
  const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const where: Prisma.WorkHistoryWhereInput = {
    deletedAt: null,
    ...filter,
    ...(dateFrom || dateTo
      ? {
          workDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };
  const rows = await prisma.workHistory.findMany({
    where,
    orderBy: { workDate: "asc" },
    include: { tree: { select: { treeNumber: true } }, vendor: { select: { vendorName: true } } },
  });

  const columns = [
    { header: "作業番号", width: 90 },
    { header: "作業日", width: 70 },
    { header: "作業種別", width: 90 },
    { header: "実施主体", width: 70 },
    { header: "事業者", width: 110 },
    { header: "対象樹木", width: 90 },
    { header: "作業内容メモ", width: 220 },
  ];
  const tableRows = rows.map((r) => [
    r.workNumber,
    r.workDate.toISOString().slice(0, 10),
    WORK_TYPE_LABELS[r.workType] ?? r.workType,
    PERFORMER_TYPE_LABELS[r.performerType] ?? r.performerType,
    r.vendor?.vendorName ?? "",
    r.tree.treeNumber,
    r.workNotes ?? "",
  ]);
  const periodLabel =
    dateFrom || dateTo
      ? `対象期間: ${dateFrom ?? "指定なし"} 〜 ${dateTo ?? "指定なし"}`
      : "対象期間: 全期間";
  sendTablePdf(res, "work-schedule", "作業予定簿", periodLabel, columns, tableRows);
});

// 作業前後の写真登録(機能要件#9)。ファイルは事前に /api/files でアップロード済みとし、
// ここではfileIdとphotoType(before/after)を紐づけるだけにする。
workHistoryRouter.post("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("workHistory", "update", req.user!);
  const workHistoryId = String(req.params.id);
  const workHistory = await prisma.workHistory.findFirst({
    where: { id: workHistoryId, deletedAt: null },
  });
  if (!workHistory) throw new NotFoundError();

  const { fileId, photoType, sortOrder } = parseOrThrow(workHistoryPhotoCreateSchema, req.body);
  const photo = await prisma.workHistoryPhoto.create({
    data: { workHistoryId, fileId, photoType, sortOrder: sortOrder ?? 0 },
  });
  res.status(201).json(photo);
});

workHistoryRouter.get("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("workHistory", "read", req.user!);
  const photos = await prisma.workHistoryPhoto.findMany({
    where: { workHistoryId: String(req.params.id) },
    include: { file: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ data: photos });
});
