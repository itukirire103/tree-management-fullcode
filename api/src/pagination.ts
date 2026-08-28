import type { Request } from "express";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(req: Request): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, pageSize: number) {
  // 今日Power Platform版で踏んだ「一部しか返ってこない」バグを防ぐため、
  // 常にtotalを明示的に返す。フロントエンドは必ずこれで全件数を検証できる。
  return { data, total, page, pageSize };
}
