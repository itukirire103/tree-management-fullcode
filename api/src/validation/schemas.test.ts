import { describe, expect, it } from "vitest";
import { ValidationError } from "../errors.js";
import { parseOrThrow } from "./parse.js";
import {
  complaintCreateSchema,
  diagnosisPhotoCreateSchema,
  inspectionPhotoCreateSchema,
  replantCreateSchema,
  treeCreateSchema,
  workHistoryCreateSchema,
} from "./schemas.js";

describe("parseOrThrow", () => {
  it("成功時はパース済みデータを返す", () => {
    const data = parseOrThrow(treeCreateSchema, {
      treeNumber: "芝05-001",
      latitude: 35.6,
      longitude: 139.7,
    });
    expect(data).toMatchObject({ treeNumber: "芝05-001", latitude: 35.6, longitude: 139.7 });
  });

  it("失敗時はValidationErrorを投げる", () => {
    expect(() => parseOrThrow(treeCreateSchema, {})).toThrow(ValidationError);
  });
});

describe("treeCreateSchema", () => {
  it("必須項目(treeNumber/latitude/longitude)が無いと失敗する", () => {
    const result = treeCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("最小限の必須項目のみでも成功する", () => {
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: 35.6,
      longitude: 139.7,
    });
    expect(result.success).toBe(true);
  });

  it("id/createdAt等の未知フィールドが混入すると拒否する(strict)", () => {
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: 35.6,
      longitude: 139.7,
      id: "fake-id",
      createdAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("定義されていないenum値は拒否する", () => {
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: 35.6,
      longitude: 139.7,
      leafType: "不正な値",
    });
    expect(result.success).toBe(false);
  });

  it("緯度経度が数値でない場合は拒否する", () => {
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: "北緯35度",
      longitude: 139.7,
    });
    expect(result.success).toBe(false);
  });

  it("フロントの<input type=number>が送る文字列表現の数値も受け付ける(coerce)", () => {
    // web/src/entities/queries.tsのtoSubmitPayloadは数値も常に文字列として送るため、
    // バックエンド側で文字列→数値の変換を許容する必要がある。
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: "35.6",
      longitude: "139.7",
      treeHeight: "12.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe(35.6);
      expect(result.data.longitude).toBe(139.7);
      expect(result.data.treeHeight).toBe(12.5);
    }
  });

  it("任意の数値項目が空文字列で送られた場合はnullとして扱う", () => {
    const result = treeCreateSchema.safeParse({
      treeNumber: "芝05-001",
      latitude: 35.6,
      longitude: 139.7,
      treeHeight: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.treeHeight).toBeNull();
    }
  });
});

describe("complaintCreateSchema", () => {
  it("treeIdが無くても成功する(要件定義書上は任意)", () => {
    const result = complaintCreateSchema.safeParse({
      complaintNumber: "C-001",
      requestDate: new Date("2026-08-01"),
    });
    expect(result.success).toBe(true);
  });

  it("必須項目(complaintNumber/requestDate)が無いと失敗する", () => {
    const result = complaintCreateSchema.safeParse({ treeId: crypto.randomUUID() });
    expect(result.success).toBe(false);
  });
});

describe("workHistoryCreateSchema", () => {
  it("workType/performerTypeが未定義の値だと失敗する", () => {
    const result = workHistoryCreateSchema.safeParse({
      workNumber: "W-001",
      treeId: crypto.randomUUID(),
      workType: "存在しない作業種別",
      workDate: new Date("2026-08-01"),
      performerType: "ward",
    });
    expect(result.success).toBe(false);
  });

  it("正しい値なら成功する", () => {
    const result = workHistoryCreateSchema.safeParse({
      workNumber: "W-001",
      treeId: crypto.randomUUID(),
      workType: "pruning",
      workDate: new Date("2026-08-01"),
      performerType: "ward",
    });
    expect(result.success).toBe(true);
  });
});

describe("diagnosisPhotoCreateSchema / inspectionPhotoCreateSchema", () => {
  it("fileIdがUUID形式でないと失敗する", () => {
    expect(diagnosisPhotoCreateSchema.safeParse({ fileId: "not-a-uuid" }).success).toBe(false);
    expect(inspectionPhotoCreateSchema.safeParse({ fileId: "not-a-uuid" }).success).toBe(false);
  });

  it("正しいUUIDのfileIdなら成功する(sortOrder省略可)", () => {
    const fileId = crypto.randomUUID();
    expect(diagnosisPhotoCreateSchema.safeParse({ fileId }).success).toBe(true);
    expect(inspectionPhotoCreateSchema.safeParse({ fileId, sortOrder: "2" }).success).toBe(true);
  });
});

describe("replantCreateSchema", () => {
  it("oldTreeId/newTreeIdがUUID形式でないと失敗する", () => {
    const result = replantCreateSchema.safeParse({
      replantNumber: "R-001",
      replantDate: new Date("2026-08-01"),
      oldTreeId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
