import type { Router } from "express";
import { createCrudRouter, prisma } from "../crud.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import {
  inspectionCreateSchema,
  inspectionPhotoCreateSchema,
  inspectionUpdateSchema,
} from "../validation/schemas.js";

// 点検記録の「点検写真」は要件定義書上、番号プレート/全景/樹冠部/主要部/根元部の
// 最大5枚(機能要件#15相当)。
const MAX_INSPECTION_PHOTOS = 5;

export const inspectionRouter: Router = createCrudRouter({
  entity: "inspection",
  delegate: prisma.inspection,
  orderBy: { inspectionDate: "desc" },
  treeIdFilter: true,
  createSchema: inspectionCreateSchema,
  updateSchema: inspectionUpdateSchema,
});

inspectionRouter.post("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("inspection", "update", req.user!);
  const inspectionId = String(req.params.id);
  const inspection = await prisma.inspection.findFirst({ where: { id: inspectionId, deletedAt: null } });
  if (!inspection) throw new NotFoundError();

  const existingCount = await prisma.inspectionPhoto.count({ where: { inspectionId } });
  if (existingCount >= MAX_INSPECTION_PHOTOS) {
    throw new ValidationError(`点検写真は最大${MAX_INSPECTION_PHOTOS}枚までです。`);
  }

  const { fileId, sortOrder } = parseOrThrow(inspectionPhotoCreateSchema, req.body);
  const photo = await prisma.inspectionPhoto.create({
    data: { inspectionId, fileId, sortOrder: sortOrder ?? 0 },
  });
  res.status(201).json(photo);
});

inspectionRouter.get("/:id/photos", requireAuth, async (req, res) => {
  await checkPermissionAndGetFilter("inspection", "read", req.user!);
  const photos = await prisma.inspectionPhoto.findMany({
    where: { inspectionId: String(req.params.id) },
    include: { file: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ data: photos });
});
