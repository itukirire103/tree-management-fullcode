import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { parsePagination, paginatedResponse } from "../pagination.js";

// 監査ログの閲覧はsystem_admin/facility_adminのみ(操作記録という性質上、
// 一般職員/委託事業者に見せる情報ではないため)。
export const auditLogRouter = Router();
auditLogRouter.use(requireAuth, requireRole("system_admin", "facility_admin"));

auditLogRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req);
  const { tableName, recordId, action, from, to } = req.query as Record<string, string | undefined>;

  const where: Prisma.AuditLogWhereInput = {
    ...(tableName ? { tableName } : {}),
    ...(recordId ? { recordId } : {}),
    ...(action ? { action: action as Prisma.EnumAuditActionFilter } : {}),
    ...(from || to
      ? {
          changedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { changedAt: "desc" },
      include: { changedByUser: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json(paginatedResponse(data, total, page, pageSize));
});
