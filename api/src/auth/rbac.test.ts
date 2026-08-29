import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { getPermission, isSystemAdmin, PERMISSION_MATRIX, type Entity } from "./rbac.js";

const ALL_ENTITIES = Object.keys(PERMISSION_MATRIX) as Entity[];
const ALL_ROLES: Role[] = [
  "system_admin",
  "facility_admin",
  "ward_staff",
  "contractor",
  "partner_admin",
  "readonly_other",
];

describe("isSystemAdmin", () => {
  it("system_adminのみtrueを返す", () => {
    for (const role of ALL_ROLES) {
      expect(isSystemAdmin(role)).toBe(role === "system_admin");
    }
  });
});

describe("getPermission", () => {
  it("system_adminは全エンティティでglobalのフル権限を持つ", () => {
    for (const entity of ALL_ENTITIES) {
      expect(getPermission(entity, "system_admin")).toEqual({
        create: "global",
        read: "global",
        update: "global",
        delete: "global",
      });
    }
  });

  it("PERMISSION_MATRIXに定義済みの組み合わせはその値をそのまま返す", () => {
    for (const entity of ALL_ENTITIES) {
      for (const role of ALL_ROLES) {
        if (role === "system_admin") continue;
        const expected = PERMISSION_MATRIX[entity][role];
        if (expected === undefined) continue;
        expect(getPermission(entity, role)).toEqual(expected);
      }
    }
  });

  it("マトリクスに未定義のロールはnone権限(NONE)を返す", () => {
    // complaintにはreadonly_otherの定義がない(仕様表の"―")
    expect(getPermission("complaint", "readonly_other")).toEqual({
      create: "none",
      read: "none",
      update: "none",
      delete: "none",
    });
    // vendorにもreadonly_otherの定義がない
    expect(getPermission("vendor", "readonly_other")).toEqual({
      create: "none",
      read: "none",
      update: "none",
      delete: "none",
    });
  });

  it("削除権限はどのロール・エンティティでもnone(system_admin以外)", () => {
    for (const entity of ALL_ENTITIES) {
      for (const role of ALL_ROLES) {
        if (role === "system_admin") continue;
        expect(getPermission(entity, role).delete).toBe("none");
      }
    }
  });
});
