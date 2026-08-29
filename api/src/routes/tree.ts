import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter } from "../auth/scope.js";
import { parsePagination, paginatedResponse } from "../pagination.js";
import { NotFoundError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import { treeCreateSchema, treeUpdateSchema } from "../validation/schemas.js";

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

treeRouter.get("/", async (req, res) => {
  const filter = (await checkPermissionAndGetFilter("tree", "read", req.user!)) as
    | Prisma.TreeWhereInput
    | undefined;
  const { skip, take, page, pageSize } = parsePagination(req);
  const { status, healthStatus, species, q } = req.query as Record<string, string>;

  const where: Prisma.TreeWhereInput = {
    deletedAt: null,
    ...filter,
    ...(status ? { status: status as Prisma.EnumTreeStatusFilter } : {}),
    ...(healthStatus
      ? { healthStatus: healthStatus as Prisma.EnumHealthStatusNullableFilter }
      : {}),
    ...(species ? { species: { contains: species, mode: "insensitive" } } : {}),
    ...(q ? { treeNumber: { contains: q, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.tree.findMany({ where, skip, take, orderBy: { treeNumber: "asc" } }),
    prisma.tree.count({ where }),
  ]);
  res.json(paginatedResponse(data, total, page, pageSize));
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
