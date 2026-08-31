import type { Role } from "@prisma/client";

// アクセス範囲: 全体(組織全体) / エリア(担当エリアのみ) / 自分(自分のレコードのみ) / なし
export type Scope = "global" | "area" | "own" | "none";
export const SCOPES: Scope[] = ["global", "area", "own", "none"];

export type Permission = {
  create: Scope;
  read: Scope;
  update: Scope;
  delete: Scope;
};
export const ACTIONS: (keyof Permission)[] = ["create", "read", "update", "delete"];

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
  | "vendor"
  | "schedule";

export const ENTITIES: Entity[] = [
  "tree",
  "diagnosis",
  "inspection",
  "workHistory",
  "replant",
  "complaint",
  "vendor",
  "schedule",
];

export const NONE_PERMISSION: Permission = { create: "none", read: "none", update: "none", delete: "none" };

// 機能要件#3(システム管理者はアカウント種類毎に利用権限を追加・変更できること)対応により、
// 実行時に参照される権限マトリクスは api/src/auth/permissionStore.ts がDB(role_permissions
// テーブル)から動的に構築する。この定数はそのDBの初期投入値(seed)と、
// 「意図されたデフォルトはこうである」というテスト用の仕様値としてのみ使う
// (checkPermissionAndGetFilterから直接参照されることはない)。
export const DEFAULT_PERMISSION_MATRIX: Record<Entity, Partial<Record<Role, Permission>>> = {
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
  // 機能要件#24(定期点検・作業予定の登録)。workHistoryと同じ考え方
  // (実施主体である区職員/委託事業者は担当範囲内で予定も管理できる)を踏襲する。
  schedule: {
    facility_admin: { create: "global", read: "global", update: "global", delete: "none" },
    ward_staff: { create: "global", read: "global", update: "global", delete: "none" },
    contractor: { create: "area", read: "area", update: "area", delete: "none" },
    partner_admin: { create: "none", read: "area", update: "none", delete: "none" },
    readonly_other: { create: "none", read: "global", update: "none", delete: "none" },
  },
};

export function isSystemAdmin(role: Role): boolean {
  return role === "system_admin";
}

export const FULL_PERMISSION: Permission = { create: "global", read: "global", update: "global", delete: "global" };

// デフォルト値(seed用・テスト用)を返す。実行時の認可判定には
// permissionStore.tsのgetPermission(DB駆動)を使うこと。
export function getDefaultPermission(entity: Entity, role: Role): Permission {
  if (isSystemAdmin(role)) {
    return FULL_PERMISSION;
  }
  return DEFAULT_PERMISSION_MATRIX[entity][role] ?? NONE_PERMISSION;
}
