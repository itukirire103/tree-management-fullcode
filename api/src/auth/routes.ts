import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signAccessToken, generateRefreshToken, hashToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refresh_token";
const isProd = process.env.NODE_ENV === "production";

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email/passwordは必須です。" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います。" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います。" });
    return;
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    expires: expiresAt,
  });
  res.json({
    accessToken,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
  });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "リフレッシュトークンがありません。" });
    return;
  }

  const tokenHash = hashToken(token);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!stored || !stored.user.isActive) {
    res.status(401).json({ error: "リフレッシュトークンが無効です。" });
    return;
  }

  // ローテーション: 使用済みトークンは失効させ、新しいものを発行する。
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const { token: newRefreshToken, tokenHash: newHash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: stored.userId, tokenHash: newHash, expiresAt },
  });

  const accessToken = signAccessToken({ sub: stored.user.id, role: stored.user.role });
  res.cookie(REFRESH_COOKIE, newRefreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    expires: expiresAt,
  });
  res.json({ accessToken });
});

// リフレッシュ後のフロントエンドがユーザー情報(表示名・ロール)を
// 再取得するためのエンドポイント。/refreshはaccessTokenのみ返すため。
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "ユーザーが見つかりません。" });
    return;
  }
  res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(REFRESH_COOKIE);
  res.status(204).send();
});
