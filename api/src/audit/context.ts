import { AsyncLocalStorage } from "node:async_hooks";

type AuditContext = { userId: string | null };

// 監査ログの「誰が変更したか」をPrisma拡張機能側から参照するための仕組み。
// Prismaのクエリ拡張はリクエスト情報を直接受け取れないため、
// requireAuthミドルウェアでリクエストごとにAsyncLocalStorageへuserIdを積んでおき、
// 拡張機能側はここから読み出す。
const storage = new AsyncLocalStorage<AuditContext>();

export function runWithAuditContext<T>(userId: string | null, fn: () => T): T {
  return storage.run({ userId }, fn);
}

export function getAuditUserId(): string | null {
  return storage.getStore()?.userId ?? null;
}
