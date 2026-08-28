import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "./jwt.js";
import { prisma } from "../db.js";

export type AuthenticatedUser = {
  id: string;
  role: Role;
  vendorId: string | null;
  areaIds: string[];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "認証が必要です。" });
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { userAreas: { select: { areaId: true } } },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "無効なユーザーです。" });
      return;
    }
    req.user = {
      id: user.id,
      role: user.role,
      vendorId: user.vendorId,
      areaIds: user.userAreas.map((a) => a.areaId),
    };
    next();
  } catch {
    res.status(401).json({ error: "トークンが無効です。" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "この操作を行う権限がありません。" });
      return;
    }
    next();
  };
}
