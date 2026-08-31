import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "node:path";

// pdfkitの既定フォントは日本語グリフを持たないため、実行環境(本番含む)の
// システムフォントに依存せずリポジトリ同梱のIPAゴシックを明示的に使う。
const JP_FONT_PATH = path.resolve(__dirname, "../assets/fonts/ipag.ttf");

export type ExportColumn = { key: string; header: string };

// PrismaのDecimal型(decimal.js)はプレーンなオブジェクトのため、CSVへ渡すと
// String(value)自体は数値文字列になり問題ないが、Excel(exceljs)のセルへ
// そのまま渡すと「数値ではなくテキストとして格納された数値」になってしまう
// (SUM等の数式に使えない、右寄せされない)。@prisma/clientを直接importせず
// toNumber()を持つかどうかで判定する(ここはエンティティ非依存の汎用モジュールのため)。
function normalizeCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return value;
}

function toCsvValue(value: unknown): string {
  const normalized = normalizeCellValue(value);
  if (normalized === null || normalized === undefined) return "";
  const s = normalized instanceof Date ? normalized.toISOString() : String(normalized);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// 機能要件#11/#25(台帳・作業予定簿のCSV/Excel出力)向けの共通エクスポート処理。
// エンティティごとに列定義(exportColumns)だけ渡せば、CSV/Excelどちらでも
// 同じデータから出力できるようにする。

// 先頭にBOMを付け、Excelで開いた際に文字化けしないUTF-8として出力する。
export function sendCsv(
  res: Response,
  filenameBase: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const header = columns.map((c) => toCsvValue(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => toCsvValue(row[c.key])).join(","));
  const csv = "﻿" + [header, ...lines].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
  res.send(csv);
}

export async function sendExcel(
  res: Response,
  filenameBase: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const normalized: Record<string, unknown> = {};
    for (const c of columns) normalized[c.key] = normalizeCellValue(row[c.key]);
    sheet.addRow(normalized);
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

// 機能要件#25(指定期間の作業予定簿を所定の様式で作成しPDF出力)向けの簡易テーブルPDF。
// pdfkit自体にはテーブル機能が無いため、列幅を指定した手動レイアウトで描画する。
export function sendTablePdf(
  res: Response,
  filenameBase: string,
  title: string,
  subtitle: string,
  columns: { header: string; width: number }[],
  rows: string[][]
): void {
  const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.pdf"`);
  doc.pipe(res);

  doc.font(JP_FONT_PATH);
  doc.fontSize(14).text(title, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).text(subtitle, { align: "center" });
  doc.moveDown(0.8);

  const startX = doc.page.margins.left;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const rowHeight = 22;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  let y = doc.y;

  function drawRow(cells: string[], isHeader: boolean) {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    let x = startX;
    doc.fontSize(isHeader ? 9 : 8);
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? "", x + 2, y + 5, { width: columns[i].width - 4, height: rowHeight, ellipsis: true });
      x += columns[i].width;
    }
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor("#cccccc")
      .stroke();
    y += rowHeight;
  }

  drawRow(
    columns.map((c) => c.header),
    true
  );
  for (const row of rows) {
    drawRow(row, false);
  }
  if (rows.length === 0) {
    doc.fontSize(9).text("該当するデータがありません。", startX, y + 5);
  }

  doc.end();
}
