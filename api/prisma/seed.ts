import "dotenv/config";
import bcrypt from "bcryptjs";
import type { PermissionScope, Role } from "@prisma/client";
import { prisma } from "../src/db.js";
import { ACTIONS, DEFAULT_PERMISSION_MATRIX, ENTITIES } from "../src/auth/rbac.js";

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`シード済み: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: "システム管理者",
      role: "system_admin",
    },
  });
  console.log(`システム管理者を作成しました: ${email} / 初期パスワード: ${password}`);
}

// 機能要件#3(システム管理者はアカウント種類毎に権限を追加・変更できること)向けに
// 権限マトリクスをDB化した(role_permissionsテーブル)。初回のみ、rbac.tsの
// DEFAULT_PERMISSION_MATRIXをそのままDBへ投入する(以後はAPI経由での編集が正になる)。
async function seedRolePermissions() {
  const existingCount = await prisma.rolePermission.count();
  if (existingCount > 0) {
    console.log("role_permissionsは既にシード済みです。");
    return;
  }

  const rows: { role: Role; entity: string; action: string; scope: PermissionScope }[] = [];
  for (const entity of ENTITIES) {
    const rolePermissions = DEFAULT_PERMISSION_MATRIX[entity];
    for (const role of Object.keys(rolePermissions) as Role[]) {
      const permission = rolePermissions[role]!;
      for (const action of ACTIONS) {
        rows.push({ role, entity, action, scope: permission[action] });
      }
    }
  }
  await prisma.rolePermission.createMany({ data: rows });
  console.log(`role_permissionsに${rows.length}件を初期投入しました。`);
}

async function main() {
  await seedAdminUser();
  await seedRolePermissions();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
