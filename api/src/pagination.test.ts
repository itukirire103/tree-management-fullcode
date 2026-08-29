import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { paginatedResponse, parsePagination } from "./pagination.js";

function mockRequest(query: Record<string, string>): Request {
  return { query } as unknown as Request;
}

describe("parsePagination", () => {
  it("クエリ未指定時はデフォルト値(page=1, pageSize=20)を返す", () => {
    expect(parsePagination(mockRequest({}))).toEqual({ skip: 0, take: 20, page: 1, pageSize: 20 });
  });

  it("page/pageSizeを指定するとskipを正しく計算する", () => {
    expect(parsePagination(mockRequest({ page: "3", pageSize: "10" }))).toEqual({
      skip: 20,
      take: 10,
      page: 3,
      pageSize: 10,
    });
  });

  it("pageSizeは100を上限にクランプされる", () => {
    expect(parsePagination(mockRequest({ pageSize: "500" }))).toMatchObject({ pageSize: 100 });
  });

  it("0以下やNaNのpage/pageSizeは1に補正される", () => {
    expect(parsePagination(mockRequest({ page: "0", pageSize: "-5" }))).toMatchObject({
      page: 1,
      pageSize: 1,
    });
    expect(parsePagination(mockRequest({ page: "abc", pageSize: "xyz" }))).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });
});

describe("paginatedResponse", () => {
  it("data/total/page/pageSizeをそのまま含んだオブジェクトを返す", () => {
    const data = [{ id: 1 }, { id: 2 }];
    expect(paginatedResponse(data, 42, 2, 20)).toEqual({ data, total: 42, page: 2, pageSize: 20 });
  });
});
