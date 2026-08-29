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
