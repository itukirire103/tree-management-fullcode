import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { fileStorage } from "../storage/index.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { ForbiddenError } from "../auth/scope.js";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } });

export const fileRouter = Router();
fileRouter.use(requireAuth);

// 診断報告書PDFや作業前後写真など、樹木ドメインの各テーブルからFile.idで参照される
// 汎用アップロード窓口。権限は「ログイン済みであれば誰でもアップロード可」とし、
// 閲覧・削除も同様に個別レコードのRBACへは踏み込まない
// (アップロード元(diagnosis/workHistory)側のRBACで既に絞られている前提の簡略化)。
fileRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) throw new ValidationError("ファイルが指定されていません。");
  const ext = path.extname(req.file.originalname);
  const storageKey = `uploads/${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  await fileStorage.put(storageKey, req.file.buffer, req.file.mimetype);
  const file = await prisma.file.create({
    data: {
      storageKey,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedByUserId: req.user!.id,
    },
  });
  res.status(201).json({
    id: file.id,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
  });
});

fileRouter.get("/:id", async (req, res) => {
  const file = await prisma.file.findUnique({ where: { id: String(req.params.id) } });
  if (!file) throw new NotFoundError();
  res.json({
    id: file.id,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
  });
});

fileRouter.get("/:id/download", async (req, res) => {
  const file = await prisma.file.findUnique({ where: { id: String(req.params.id) } });
  if (!file) throw new NotFoundError();
  const resolution = await fileStorage.resolveDownload(file.storageKey, file.originalFilename, file.mimeType);
  if (resolution.kind === "redirect") {
    res.redirect(resolution.url);
    return;
  }
  res.setHeader("Content-Type", resolution.mimeType ?? file.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`
  );
  resolution.stream.pipe(res);
});

fileRouter.delete("/:id", async (req, res) => {
  const file = await prisma.file.findUnique({ where: { id: String(req.params.id) } });
  if (!file) throw new NotFoundError();
  const isOwner = file.uploadedByUserId === req.user!.id;
  const isAdmin = req.user!.role === "system_admin" || req.user!.role === "facility_admin";
  if (!isOwner && !isAdmin) throw new ForbiddenError();
  await fileStorage.delete(file.storageKey);
  await prisma.file.delete({ where: { id: file.id } });
  res.status(204).send();
});
