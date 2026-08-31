import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { sendCsv, sendExcel } from "./export.js";
import ExcelJS from "exceljs";

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

// Prismaの緯度経度・樹高等はDecimal型(decimal.jsのオブジェクト、toNumber()を持つ)で
//返ってくる。exceljsにオブジェクトのまま渡すと「テキストとして格納された数値」に
// なり、Excel上でSUM等の数式に使えず右寄せもされない不具合があったため、
// セルへは必ずNumberへ変換してから渡していることを確認する回帰テスト。
function fakeDecimal(n: number) {
  return { toNumber: () => n };
}

function mockExpressResponse() {
  const chunks: Buffer[] = [];
  const res = {
    setHeader: vi.fn(),
    write: vi.fn((chunk: Buffer) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(),
  } as unknown as Response;
  return { res, getBuffer: () => Buffer.concat(chunks) };
}

describe("sendExcel", () => {
  it("Decimal(toNumber()を持つオブジェクト)を数値セルとして出力する", async () => {
    const { res, getBuffer } = mockExpressResponse();
    await sendExcel(res, "tree", "tree", [{ key: "latitude", header: "緯度" }], [
      { latitude: fakeDecimal(35.658123) },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(getBuffer() as unknown as ArrayBuffer);
    const cell = wb.worksheets[0]!.getRow(2).getCell(1);
    expect(cell.value).toBe(35.658123);
    expect(typeof cell.value).toBe("number");
  });

  it("nullは空セルとして出力する", async () => {
    const { res, getBuffer } = mockExpressResponse();
    await sendExcel(res, "tree", "tree", [{ key: "notes", header: "備考" }], [{ notes: null }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(getBuffer() as unknown as ArrayBuffer);
    const cell = wb.worksheets[0]!.getRow(2).getCell(1);
    expect(cell.value).toBeNull();
  });
});
