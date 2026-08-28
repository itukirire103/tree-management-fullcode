import { PrismaClient } from "@prisma/client";
import { createAuditExtension } from "./audit/extension.js";

// 監査ログの書き込み専用に、拡張していない素のクライアントを使う
// (拡張後のclientでauditLog.create()を呼んでも対象モデルに含めていないので
// 実際には再帰しないが、責務を明確に分けるためあえて分離している)。
const auditWriter = new PrismaClient();

export const prisma = auditWriter.$extends(createAuditExtension(auditWriter));
