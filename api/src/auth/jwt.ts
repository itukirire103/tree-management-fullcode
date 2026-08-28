import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { Role } from "@prisma/client";

// process.env.* は string | undefined 型のため、関数内から参照すると
// TypeScriptがnarrowingを引き継げない。ガード後に別定数へ入れ直すことで、
// 以降は確実にstring型として扱えるようにする。
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const ACCESS_SECRET: string = requireEnv("JWT_ACCESS_SECRET");
const REFRESH_SECRET: string = requireEnv("JWT_REFRESH_SECRET");

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";

export type AccessTokenPayload = {
  sub: string; // userId
  role: Role;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

// リフレッシュトークンは「生のトークン文字列」自体はDBに保存せず、
// ハッシュ値だけを保存する(漏洩時の被害を限定するため)。
export function generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseDurationMs(REFRESH_EXPIRES_IN));
  return { token, tokenHash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", REFRESH_SECRET).update(token).digest("hex");
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // fallback: 30日
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}
