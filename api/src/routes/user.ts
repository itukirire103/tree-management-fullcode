import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { parseOrThrow } from "../validation/parse.js";
import { userCreateSchema, userUpdateSchema } from "../validation/schemas.js";
import { NotFoundError, ValidationError } from "../errors.js";

const BCRYPT_ROUNDS = 12;

export const userRouter = Router();
userRouter.use(requireAuth);

// エリア割当てUIで「どのユーザーに割り当てるか」を選ぶための一覧(有効なユーザーのみ)。
// system_admin/facility_adminの両方が使う既存の用途のため、アカウント管理より緩い権限のまま残す。
userRouter.get("/", requireRole("system_admin", "facility_admin"), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, displayName: true, role: true, vendorId: true },
    orderBy: { displayName: "asc" },
  });
  res.json({ data: users });
});

// 機能要件#2: アカウントの登録・変更・停止。権限マトリクス編集と同様、
// これより先はsystem_admin限定にする(アカウント管理はエリア割当てより一段強い操作のため)。
userRouter.use(requireRole("system_admin"));

// 管理画面用: 停止中(isActive:false)のアカウントも含めた全件一覧。
userRouter.get("/all", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      vendorId: true,
      isActive: true,
      mfaEnabled: true,
      createdAt: true,
    },
    orderBy: { displayName: "asc" },
  });
  res.json({ data: users });
});

userRouter.post("/", async (req, res) => {
  const data = parseOrThrow(userCreateSchema, req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ValidationError("このメールアドレスは既に使用されています。");

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      role: data.role,
      vendorId: data.vendorId ?? null,
    },
  });
  res.status(201).json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    vendorId: user.vendorId,
    isActive: user.isActive,
  });
});

userRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError();

  const data = parseOrThrow(userUpdateSchema, req.body);

  // 自分自身のロール変更・無効化を禁止する(唯一のsystem_adminが誤操作で
  // ロックアウトされる事故を防ぐための最小限のガード)。他の管理者を
  // 無効化することは許可する。
  if (req.user!.id === id && (data.role !== undefined || data.isActive === false)) {
    throw new ValidationError("自分自身のロール変更・無効化はできません。");
  }
  // system_adminは権限マトリクス編集と同様コード側で固定の扱いのため、
  // この画面からはロールを変更できない(降格させてしまうと#3の権限マトリクス編集画面に
  // 誰もアクセスできなくなりかねないため)。
  if (target.role === "system_admin" && data.role !== undefined) {
    throw new ValidationError("システム管理者のロールは変更できません。");
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.vendorId !== undefined) updateData.vendor = data.vendorId ? { connect: { id: data.vendorId } } : { disconnect: true };
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await prisma.user.update({ where: { id }, data: updateData });
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    vendorId: user.vendorId,
    isActive: user.isActive,
  });
});
