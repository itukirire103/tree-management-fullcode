import { Router } from "express";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../db.js";
import { signAccessToken, generateRefreshToken, hashToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refresh_token";
const isProd = process.env.NODE_ENV === "production";
const MFA_ISSUER = "港区樹木管理システム";

authRouter.post("/login", async (req, res) => {
  const { email, password, totpCode } = req.body as { email?: string; password?: string; totpCode?: string };
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

  // MFAが有効なユーザーは、パスワード認証に加えてTOTPコードの検証も必須にする。
  // totpCode未指定/不正の場合はmfaRequired:trueを返し、フロントに入力欄を出させる
  // (パスワード誤りと区別できるよう、一般的な認証失敗とは別扱いにしている)。
  if (user.mfaEnabled) {
    if (!totpCode) {
      res.status(401).json({ error: "認証コードを入力してください。", mfaRequired: true });
      return;
    }
    const result = await verifyTotp({ secret: user.totpSecret!, token: totpCode });
    if (!result.valid) {
      res.status(401).json({ error: "認証コードが正しくありません。", mfaRequired: true });
      return;
    }
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
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
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
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
  });
});

// MFA(TOTP)設定。setup→(認証アプリでQR読み取り)→verifyの2段階にしているのは、
// 読み取りミス等で本人が意図せずロックアウトされるのを防ぐため
// (verifyで正しいコードが確認できるまでmfaEnabledはfalseのまま)。
authRouter.post("/mfa/setup", requireAuth, async (req, res) => {
  const secret = generateSecret();
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { totpSecret: secret, mfaEnabled: false },
  });
  const otpauthUrl = generateURI({ issuer: MFA_ISSUER, label: user.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({ secret, otpauthUrl, qrCodeDataUrl });
});

authRouter.post("/mfa/verify", requireAuth, async (req, res) => {
  const { code } = req.body as { code?: string };
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.totpSecret) {
    res.status(400).json({ error: "先にMFAのセットアップを行ってください。" });
    return;
  }
  if (!code) {
    res.status(400).json({ error: "認証コードを入力してください。" });
    return;
  }
  const result = await verifyTotp({ secret: user.totpSecret, token: code });
  if (!result.valid) {
    res.status(400).json({ error: "認証コードが正しくありません。" });
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  res.status(204).send();
});

// 無効化にも現在有効なTOTPコードを要求する(アクセストークンを盗まれただけでは
// 無効化できないようにする、標準的なUXパターン)。
authRouter.post("/mfa/disable", requireAuth, async (req, res) => {
  const { code } = req.body as { code?: string };
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaEnabled || !user.totpSecret) {
    res.status(400).json({ error: "MFAは有効化されていません。" });
    return;
  }
  if (!code) {
    res.status(400).json({ error: "認証コードを入力してください。" });
    return;
  }
  const result = await verifyTotp({ secret: user.totpSecret, token: code });
  if (!result.valid) {
    res.status(400).json({ error: "認証コードが正しくありません。" });
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, totpSecret: null } });
  res.status(204).send();
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
