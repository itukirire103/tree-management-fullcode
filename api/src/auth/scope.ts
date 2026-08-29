import type { Entity, Scope } from "./rbac.js";
import { getPermission } from "./permissionStore.js";
import type { AuthenticatedUser } from "./middleware.js";
import { prisma } from "../db.js";

// エンティティごとに「担当エリア」をどう判定するかの設定。
// tree/complaintは自身のroute_number列、それ以外はtree経由(リレーション)で判定する。
type AreaFilterConfig =
  | { kind: "direct"; field: string }
  | { kind: "viaTree"; treeField: string }
  | { kind: "viaEitherTree"; treeFields: [string, string] };

const AREA_FILTER_CONFIG: Record<Entity, AreaFilterConfig | null> = {
  tree: { kind: "direct", field: "routeNumber" },
  complaint: { kind: "direct", field: "routeNumber" },
  diagnosis: { kind: "viaTree", treeField: "tree" },
  inspection: { kind: "viaTree", treeField: "tree" },
  workHistory: { kind: "viaTree", treeField: "tree" },
  // replantはold/newどちらかの樹木が担当エリアに含まれれば閲覧可とする
  replant: { kind: "viaEitherTree", treeFields: ["oldTree", "newTree"] },
  vendor: null, // vendorはown scopeのみ(下記で別処理)
};

export class ForbiddenError extends Error {
  constructor(message = "この操作を行う権限がありません。") {
    super(message);
  }
}

async function getAreaRouteNumbers(user: AuthenticatedUser): Promise<string[]> {
  if (user.areaIds.length === 0) return [];
  const areas = await prisma.area.findMany({
    where: { id: { in: user.areaIds } },
    select: { routeNumbers: true },
  });
  return areas.flatMap((a) => a.routeNumbers);
}

// 各Prismaモデルのwhere句型はモデルごとに異なるため、ここでは共通の
// 素朴なオブジェクト型として返す。呼び出し側(各ルート)で該当モデルの
// WhereInput型にキャストして使う(scope.ts自体はモデル非依存に保つ設計)。
export type ScopeFilter = Record<string, unknown> | undefined;

/**
 * 指定した操作(action)を実行する権限があるかチェックし、無ければForbiddenErrorを投げる。
 * "area"/"own" スコープの場合は、後続のクエリに使うwhere句フィルタも返す。
 */
export async function checkPermissionAndGetFilter(
  entity: Entity,
  action: "create" | "read" | "update" | "delete",
  user: AuthenticatedUser
): Promise<ScopeFilter> {
  const permission = await getPermission(entity, user.role);
  const scope: Scope = permission[action];

  if (scope === "none") {
    throw new ForbiddenError();
  }
  if (scope === "global") {
    return undefined; // フィルタなし=全件対象
  }
  if (scope === "own") {
    if (!user.vendorId) throw new ForbiddenError();
    return { id: user.vendorId };
  }

  // scope === "area"
  const routeNumbers = await getAreaRouteNumbers(user);
  if (routeNumbers.length === 0) {
    // エリア未割当てのユーザーは何も見えない(空集合フィルタ)
    return { id: { in: [] } };
  }

  const config = AREA_FILTER_CONFIG[entity];
  if (!config) {
    // replant等、個別ハンドリングが必要なエンティティはここに来ない想定
    return { id: { in: [] } };
  }
  if (config.kind === "direct") {
    return { [config.field]: { in: routeNumbers } };
  }
  if (config.kind === "viaTree") {
    const filter: Record<string, unknown> = {
      [config.treeField]: { is: { routeNumber: { in: routeNumbers } } },
    };
    // 街路樹管理委託事業者の作業履歴アクセスは要件上「自社実施分のみ」。
    // 協定管理者(partner_admin)は同じviaTree設定でも担当エリア全体を見てよいため、
    // contractorロールに限定してvendorIdでの絞り込みを追加する。
    if (entity === "workHistory" && user.role === "contractor") {
      if (!user.vendorId) return { id: { in: [] } };
      filter.vendorId = user.vendorId;
    }
    return filter;
  }
  const [fieldA, fieldB] = config.treeFields;
  return {
    OR: [
      { [fieldA]: { is: { routeNumber: { in: routeNumbers } } } },
      { [fieldB]: { is: { routeNumber: { in: routeNumbers } } } },
    ],
  };
}
