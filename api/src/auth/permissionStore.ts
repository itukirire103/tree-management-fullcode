import type { Role } from "@prisma/client";
import { prisma } from "../db.js";
import {
  ACTIONS,
  ENTITIES,
  FULL_PERMISSION,
  NONE_PERMISSION,
  isSystemAdmin,
  type Entity,
  type Permission,
  type Scope,
} from "./rbac.js";

// 機能要件#3: 権限マトリクスの実行時の参照元。role_permissionsテーブルの内容を
// プロセス内キャッシュに読み込み、書き込み(role-permissionsルート)があった
// タイミングでキャッシュを破棄する。Render無料枠は単一インスタンス運用のため、
// 複数インスタンス間でのキャッシュ同期は考慮していない(将来スケールする場合の課題)。
type MatrixCache = Record<Entity, Partial<Record<Role, Permission>>>;

let cache: MatrixCache | null = null;
let loadingPromise: Promise<MatrixCache> | null = null;

function emptyMatrix(): MatrixCache {
  const matrix = {} as MatrixCache;
  for (const entity of ENTITIES) matrix[entity] = {};
  return matrix;
}

async function loadFromDb(): Promise<MatrixCache> {
  const rows = await prisma.rolePermission.findMany();
  const matrix = emptyMatrix();
  for (const row of rows) {
    // entity/actionはDB上ではただの文字列のため、コード側で把握していない値
    // (将来削除されたエンティティの残存行等)は無視してfail-closedにする。
    if (!ENTITIES.includes(row.entity as Entity)) continue;
    if (!ACTIONS.includes(row.action as keyof Permission)) continue;
    const entity = row.entity as Entity;
    const existing = matrix[entity][row.role] ?? { ...NONE_PERMISSION };
    existing[row.action as keyof Permission] = row.scope as Scope;
    matrix[entity][row.role] = existing;
  }
  return matrix;
}

async function getMatrix(): Promise<MatrixCache> {
  if (cache) return cache;
  if (!loadingPromise) {
    loadingPromise = loadFromDb()
      .then((matrix) => {
        cache = matrix;
        return matrix;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

// role-permissionsルートでの更新後に呼び出し、次回参照時にDBから再読込させる。
export function invalidatePermissionCache(): void {
  cache = null;
}

// system_adminは常にフル権限(コード固定、DBの値では上書きできない)。
// それ以外のロールはDB上の値を参照し、行が無い組み合わせは"none"にフォールバックする
// (新しいエンティティをコードに追加してもseedし忘れれば安全側に倒れる)。
export async function getPermission(entity: Entity, role: Role): Promise<Permission> {
  if (isSystemAdmin(role)) return FULL_PERMISSION;
  const matrix = await getMatrix();
  return matrix[entity][role] ?? NONE_PERMISSION;
}
