import { Router } from "express";
import { createCrudRouter, prisma } from "../crud.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { NotFoundError } from "../errors.js";

export const workHistoryRouter: Router = createCrudRouter({
  entity: "workHistory",
  delegate: prisma.workHistory,
  orderBy: { workDate: "desc" },
  treeIdFilter: true,
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

  const { fileId, photoType, sortOrder } = req.body as {
    fileId: string;
    photoType: "before" | "after";
    sortOrder?: number;
  };
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
