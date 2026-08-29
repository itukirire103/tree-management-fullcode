import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { sendCsv } from "./export.js";

function mockResponse() {
  let body: unknown;
  const res = {
    setHeader: vi.fn(),
    send: vi.fn((b: unknown) => {
      body = b;
    }),
  } as unknown as Response;
  return { res, getBody: () => body };
}

describe("sendCsv", () => {
  it("先頭にBOMを付け、ヘッダー行とデータ行をCRLF区切りで出力する", () => {
    const { res, getBody } = mockResponse();
    sendCsv(
      res,
      "tree",
      [
        { key: "a", header: "列A" },
        { key: "b", header: "列B" },
      ],
      [{ a: "1", b: "2" }]
    );
    expect(getBody()).toBe("﻿列A,列B\r\n1,2");
  });

  it("カンマ・改行・ダブルクォートを含む値はダブルクォートでエスケープする", () => {
    const { res, getBody } = mockResponse();
    sendCsv(res, "tree", [{ key: "a", header: "A" }], [{ a: 'hello, "world"' }]);
    expect(getBody()).toBe('﻿A\r\n"hello, ""world"""');
  });

  it("null/undefinedは空文字として出力する", () => {
    const { res, getBody } = mockResponse();
    sendCsv(
      res,
      "tree",
      [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ],
      [{ a: null, b: undefined }]
    );
    expect(getBody()).toBe("﻿A,B\r\n,");
  });

  it("Content-Dispositionにファイル名を設定する", () => {
    const { res } = mockResponse();
    sendCsv(res, "tree", [{ key: "a", header: "A" }], []);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="tree.csv"'
    );
  });
});
