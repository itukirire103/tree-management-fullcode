import type { Router } from "express";
import { createCrudRouter, prisma } from "../crud.js";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { NotFoundError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import {
  diagnosisCreateSchema,
  diagnosisPhotoCreateSchema,
  diagnosisUpdateSchema,
} from "../validation/schemas.js";

// diagnosis.overallJudgement("A"/"B1"/"B2"/"C")が樹木マスタのhealthStatusと
// 同じ値体系であることを前提に、そのまま反映する。
const VALID_HEALTH_STATUS = new Set(["A", "B1", "B2", "C"]);

export const diagnosisRouter: Router = createCrudRouter({
  entity: "diagnosis",
  delegate: prisma.diagnosis,
  orderBy: { diagnosisDate: "desc" },
  treeIdFilter: true,
  createSchema: diagnosisCreateSchema,
  updateSchema: diagnosisUpdateSchema,
  // 業務ロジック(Dataverse版ではPower Automateで実装): 樹木診断結果が登録されると
  // 樹木マスタの健全度を自動更新する。
  onCreate: async (data) => {
    // フロントエンドからはtreeIdをフラットな外部キーとして送るため、
    // リレーションconnect形式ではなくUncheckedCreateInputを使う。
    const input = data as Prisma.DiagnosisUncheckedCreateInput;
    return prisma.$transaction(async (tx) => {
      const diagnosis = await tx.diagnosis.create({ data: input });
      const judgement = diagnosis.overallJudgement;
      if (judgement && VALID_HEALTH_STATUS.has(judgement)) {
        await tx.tree.update({
          where: { id: diagnosis.treeId },
          data: { healthStatus: judgement as "A" | "B1" | "B2" | "C" },
        });
      }
      return diagnosis;
    });
  },
});

// 樹木診断結果の「被害部写真」(機能要件#15、複数枚)。ファイルは事前に
// /api/files でアップロード済みとし、ここではfileIdの紐づけだけを行う
// (作業前後写真=WorkHistoryPhotoと同じ設計)。
diagnosisRouter.post("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("diagnosis", "update", req.user!);
  const diagnosisId = String(req.params.id);
  const diagnosis = await prisma.diagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
  if (!diagnosis) throw new NotFoundError();

  const { fileId, sortOrder } = parseOrThrow(diagnosisPhotoCreateSchema, req.body);
  const photo = await prisma.diagnosisPhoto.create({
    data: { diagnosisId, fileId, sortOrder: sortOrder ?? 0 },
  });
  res.status(201).json(photo);
});

diagnosisRouter.get("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("diagnosis", "read", req.user!);
  const photos = await prisma.diagnosisPhoto.findMany({
    where: { diagnosisId: String(req.params.id) },
    include: { file: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ data: photos });
});
