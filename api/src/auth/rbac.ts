import type { Role } from "@prisma/client";

// アクセス範囲: 全体(組織全体) / エリア(担当エリアのみ) / 自分(自分のレコードのみ) / なし
export type Scope = "global" | "area" | "own" | "none";

export type Permission = {
  create: Scope;
  read: Scope;
  update: Scope;
  delete: Scope;
};

// Dataverse版のセキュリティロール権限マトリクスをそのまま移植した設定。
// エンティティ名 × ロール → 権限。system_adminは全テーブル全権限固定なのでここには含めない
// (isSystemAdmin()で別扱いする)。
export type Entity =
  | "tree"
  | "diagnosis"
  | "inspection"
  | "workHistory"
  | "replant"
  | "complaint"
  | "vendor";

const NONE: Permission = { create: "none", read: "none", update: "none", delete: "none" };

export const PERMISSION_MATRIX: Record<Entity, Partial<Record<Role, Permission>>> = {
  tree: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "none", read: "area", update: "area", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
  diagnosis: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "none", read: "global", update: "none", delete: "none" },
    contractor: { create: "none", read: "area", update: "none", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
  inspection: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "area", read: "area", update: "area", delete: "none" },
    partner_admin: { create: "area", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
  workHistory: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "area", read: "area", update: "area", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
  replant: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "none", read: "area", update: "none", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
  complaint: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "none", read: "area", update: "none", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    // readonly_otherはcomplaintへのアクセス権なし(仕様表の"―"に対応)
  },
  vendor: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "none", read: "global", update: "none", delete: "none" },
    contractor: { create: "none", read: "own", update: "none", delete: "none" },
    partner_admin: { create: "none", read: "own", update: "none", delete: "none" },
    // readonly_otherはvendorへのアクセス権なし
  },
};

export function isSystemAdmin(role: Role): boolean {
  return role === "system_admin";
}

export function getPermission(entity: Entity, role: Role): Permission {
  if (isSystemAdmin(role)) {
    return { create: "global", read: "global", update: "global", delete: "global" };
  }
  return PERMISSION_MATRIX[entity][role] ?? NONE;
}
