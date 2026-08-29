import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "./middleware.js";
import { checkPermissionAndGetFilter, ForbiddenError } from "./scope.js";
import { invalidatePermissionCache } from "./permissionStore.js";
import { ACTIONS, DEFAULT_PERMISSION_MATRIX, ENTITIES, type Entity, type Permission } from "./rbac.js";

const findManyMock = vi.fn();
const rolePermissionFindManyMock = vi.fn();

vi.mock("../db.js", () => ({
  prisma: {
    area: { findMany: (...args: unknown[]) => findManyMock(...args) },
    rolePermission: { findMany: (...args: unknown[]) => rolePermissionFindManyMock(...args) },
  },
}));

// permissionStore.tsが参照するDB行を、rbac.tsのデフォルト権限マトリクスから機械的に
// 組み立てる。checkPermissionAndGetFilterのテスト自体はスコープ判定ロジック
// (global/area/own/none)を検証したいのであって、権限マトリクスの中身自体は
// rbac.test.tsで別途検証済みのため、ここではデフォルト値をそのままDBの中身として扱う。
function defaultRolePermissionRows(): { role: string; entity: Entity; action: string; scope: string }[] {
  const rows: { role: string; entity: Entity; action: string; scope: string }[] = [];
  for (const entity of ENTITIES) {
    const rolePermissions = DEFAULT_PERMISSION_MATRIX[entity];
    for (const role of Object.keys(rolePermissions) as (keyof typeof rolePermissions)[]) {
      const permission = rolePermissions[role] as Permission;
      for (const action of ACTIONS) {
        rows.push({ role: role as string, entity, action, scope: permission[action] });
      }
    }
  }
  return rows;
}

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: "user-1", role: "contractor", vendorId: null, areaIds: [], ...overrides };
}

beforeEach(() => {
  findManyMock.mockReset();
  rolePermissionFindManyMock.mockReset();
  rolePermissionFindManyMock.mockResolvedValue(defaultRolePermissionRows());
  invalidatePermissionCache();
});

describe("checkPermissionAndGetFilter", () => {
  it("scope=noneの操作はForbiddenErrorを投げる", async () => {
    // vendorのcontractorはcreate: "none"
    await expect(checkPermissionAndGetFilter("vendor", "create", user())).rejects.toThrow(
      ForbiddenError
    );
  });

  it("scope=globalの操作はフィルタなし(undefined)を返す", async () => {
    // treeのfacility_adminはread: "global"
    const filter = await checkPermissionAndGetFilter(
      "tree",
      "read",
      user({ role: "facility_admin" })
    );
    expect(filter).toBeUndefined();
  });

  it("scope=ownでvendorId未設定のユーザーはForbiddenError", async () => {
    // vendorのcontractorはread: "own"
    await expect(
      checkPermissionAndGetFilter("vendor", "read", user({ vendorId: null }))
    ).rejects.toThrow(ForbiddenError);
  });

  it("scope=ownでvendorId設定済みなら自身のidフィルタを返す", async () => {
    const filter = await checkPermissionAndGetFilter(
      "vendor",
      "read",
      user({ vendorId: "vendor-123" })
    );
    expect(filter).toEqual({ id: "vendor-123" });
  });

  it("scope=areaでareaIdsが空なら常に空集合フィルタ(何も見えない)", async () => {
    const filter = await checkPermissionAndGetFilter("tree", "read", user({ areaIds: [] }));
    expect(filter).toEqual({ id: { in: [] } });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scope=area かつ direct(tree/complaint)はroute_numberでフィルタする", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1", "R2"] }, { routeNumbers: ["R3"] }]);
    const filter = await checkPermissionAndGetFilter("tree", "read", user({ areaIds: ["area-1"] }));
    expect(filter).toEqual({ routeNumber: { in: ["R1", "R2", "R3"] } });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["area-1"] } },
      select: { routeNumbers: true },
    });
  });

  it("scope=area かつ viaTree(diagnosis/inspection/workHistory)はtree.routeNumber経由でフィルタする", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1"] }]);
    const filter = await checkPermissionAndGetFilter(
      "inspection",
      "read",
      user({ areaIds: ["area-1"] })
    );
    expect(filter).toEqual({ tree: { is: { routeNumber: { in: ["R1"] } } } });
  });

  it("workHistory+contractorはtree.routeNumberに加えて自社(vendorId)でも絞り込む(要件: 自社実施分のみ)", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1"] }]);
    const filter = await checkPermissionAndGetFilter(
      "workHistory",
      "read",
      user({ role: "contractor", areaIds: ["area-1"], vendorId: "vendor-123" })
    );
    expect(filter).toEqual({
      tree: { is: { routeNumber: { in: ["R1"] } } },
      vendorId: "vendor-123",
    });
  });

  it("workHistory+contractorでvendorId未設定のユーザーは何も見えない", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1"] }]);
    const filter = await checkPermissionAndGetFilter(
      "workHistory",
      "read",
      user({ role: "contractor", areaIds: ["area-1"], vendorId: null })
    );
    expect(filter).toEqual({ id: { in: [] } });
  });

  it("workHistory+partner_adminはvendorId絞り込みなしで担当エリア全体が見える(要件通り)", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1"] }]);
    const filter = await checkPermissionAndGetFilter(
      "workHistory",
      "read",
      user({ role: "partner_admin", areaIds: ["area-1"], vendorId: "vendor-123" })
    );
    expect(filter).toEqual({ tree: { is: { routeNumber: { in: ["R1"] } } } });
  });

  it("scope=area かつ viaEitherTree(replant)はoldTree/newTreeどちらかがマッチすればよいOR条件を返す", async () => {
    findManyMock.mockResolvedValue([{ routeNumbers: ["R1"] }]);
    const filter = await checkPermissionAndGetFilter(
      "replant",
      "read",
      user({ role: "contractor", areaIds: ["area-1"] })
    );
    expect(filter).toEqual({
      OR: [
        { oldTree: { is: { routeNumber: { in: ["R1"] } } } },
        { newTree: { is: { routeNumber: { in: ["R1"] } } } },
      ],
    });
  });
});
