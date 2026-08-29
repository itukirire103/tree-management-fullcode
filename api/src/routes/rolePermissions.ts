import { Router } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { ACTIONS, ENTITIES } from "../auth/rbac.js";
import { invalidatePermissionCache } from "../auth/permissionStore.js";
import { parseOrThrow } from "../validation/parse.js";
import { rolePermissionUpdateSchema } from "../validation/schemas.js";

// 機能要件#3: システム管理者がアカウント種類毎に利用権限を追加・変更できるようにする
// 権限マトリクス編集API。エリア割当て/監査ログ(system_admin・facility_admin共用)より
// 一段強い操作のため、あえてsystem_admin限定にしている。
export const rolePermissionsRouter = Router();
rolePermissionsRouter.use(requireAuth, requireRole("system_admin"));

// system_adminは常にフル権限固定(permissionStore.ts参照)で編集対象外。
const EDITABLE_ROLES: Role[] = ["facility_admin", "ward_staff", "contractor", "partner_admin", "readonly_other"];

rolePermissionsRouter.get("/", async (_req, res) => {
  const rows = await prisma.rolePermission.findMany();
  const byKey = new Map(rows.map((r) => [`${r.role}:${r.entity}:${r.action}`, r.scope]));

  // DBに行が無い組み合わせも編集グリッドを埋められるよう"none"として補完して返す。
  const data: { entity: string; role: Role; action: string; scope: string }[] = [];
  for (const entity of ENTITIES) {
    for (const role of EDITABLE_ROLES) {
      for (const action of ACTIONS) {
        data.push({
          entity,
          role,
          action,
          scope: byKey.get(`${role}:${entity}:${action}`) ?? "none",
        });
      }
    }
  }
  res.json({ data });
});

rolePermissionsRouter.patch("/", async (req, res) => {
  const { changes } = parseOrThrow(rolePermissionUpdateSchema, req.body);
  for (const change of changes) {
    await prisma.rolePermission.upsert({
      where: { role_entity_action: { role: change.role, entity: change.entity, action: change.action } },
      create: { role: change.role, entity: change.entity, action: change.action, scope: change.scope },
      update: { scope: change.scope },
    });
  }
  invalidatePermissionCache();
  res.status(204).send();
});
