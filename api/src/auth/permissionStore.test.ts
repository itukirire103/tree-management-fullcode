import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPermission, invalidatePermissionCache } from "./permissionStore.js";

const findManyMock = vi.fn();

vi.mock("../db.js", () => ({
  prisma: { rolePermission: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

beforeEach(() => {
  findManyMock.mockReset();
  invalidatePermissionCache();
});

describe("getPermission", () => {
  it("system_adminは常にフル権限を返し、DBを参照しない(コード固定)", async () => {
    const permission = await getPermission("tree", "system_admin");
    expect(permission).toEqual({ create: "global", read: "global", update: "global", delete: "global" });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("DBの行をそのままPermissionとして組み立てる", async () => {
    findManyMock.mockResolvedValue([
      { role: "ward_staff", entity: "tree", action: "read", scope: "global" },
      { role: "ward_staff", entity: "tree", action: "create", scope: "area" },
    ]);
    const permission = await getPermission("tree", "ward_staff");
    expect(permission).toEqual({ create: "area", read: "global", update: "none", delete: "none" });
  });

  it("DBに行が無い組み合わせはnone権限にフォールバックする(fail-closed)", async () => {
    findManyMock.mockResolvedValue([]);
    const permission = await getPermission("tree", "ward_staff");
    expect(permission).toEqual({ create: "none", read: "none", update: "none", delete: "none" });
  });

  it("コードが把握していないentity/action名の行は無視する", async () => {
    findManyMock.mockResolvedValue([
      { role: "ward_staff", entity: "unknown_entity", action: "read", scope: "global" },
      { role: "ward_staff", entity: "tree", action: "unknown_action", scope: "global" },
      { role: "ward_staff", entity: "tree", action: "read", scope: "global" },
    ]);
    const permission = await getPermission("tree", "ward_staff");
    expect(permission).toEqual({ create: "none", read: "global", update: "none", delete: "none" });
  });

  it("一度読み込んだ結果はキャッシュされ、以後DBを再参照しない", async () => {
    findManyMock.mockResolvedValue([{ role: "ward_staff", entity: "tree", action: "read", scope: "global" }]);
    await getPermission("tree", "ward_staff");
    await getPermission("tree", "ward_staff");
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it("invalidatePermissionCache後は次回参照時にDBを再読込する", async () => {
    findManyMock.mockResolvedValue([{ role: "ward_staff", entity: "tree", action: "read", scope: "global" }]);
    await getPermission("tree", "ward_staff");
    invalidatePermissionCache();
    await getPermission("tree", "ward_staff");
    expect(findManyMock).toHaveBeenCalledTimes(2);
  });

  it("同時に複数呼ばれてもDB読み込みは1回にまとめられる", async () => {
    let resolveFindMany: (rows: unknown[]) => void;
    findManyMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFindMany = resolve;
      })
    );
    const p1 = getPermission("tree", "ward_staff");
    const p2 = getPermission("diagnosis", "ward_staff");
    resolveFindMany!([{ role: "ward_staff", entity: "tree", action: "read", scope: "global" }]);
    await Promise.all([p1, p2]);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
