-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('global', 'area', 'own', 'none');

-- CreateTable
-- 機能要件#3: システム管理者がアカウント種類毎に権限を追加・変更できるようにするための
-- 権限マトリクスのDB化。system_admin自身の権限はコード側で固定のため、このテーブルには含まれない。
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_entity_action_key" ON "role_permissions"("role", "entity", "action");
