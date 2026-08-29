import type { Role } from "./types";

// api/src/auth/rbac.ts の PERMISSION_MATRIX.tree をフロント側のUI出し分け用に
// ミラーリングしたもの。ここでの判定はあくまでUXの都合(ボタンを出すか等)であり、
// 実際の可否は毎回サーバー側のcheckPermissionAndGetFilterで再チェックされる。
export function canCreateTree(role: Role): boolean {
  return role === "system_admin" || role === "facility_admin" || role === "ward_staff";
}

export function canEditTree(role: Role): boolean {
  // contractorはエリア範囲内のみ更新可(サーバー側でエリア判定される)。
  return canCreateTree(role) || role === "contractor";
}

// api/src/auth/rbac.ts の PERMISSION_MATRIX.vendor をミラーリング。
// readonly_otherはvendorへのアクセス権が無い(NONE)ため、メニューからも隠す
// (機能要件#4: メニュー画面はアカウント種類毎に表示を変えること)。
export function canViewVendors(role: Role): boolean {
  return role !== "readonly_other";
}

// PERMISSION_MATRIX.complaint も readonly_other は NONE。
export function canViewComplaints(role: Role): boolean {
  return role !== "readonly_other";
}
