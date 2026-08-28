import { Prisma, type PrismaClient } from "@prisma/client";
import { getAuditUserId } from "./context.js";

// 監査対象は業務ドメインの7テーブル+添付ファイル。
// 認証・セッション関連(User/RefreshToken等)やarea/audit_log自体は対象外。
const AUDITED_MODELS = new Set([
  "Tree",
  "Diagnosis",
  "Inspection",
  "WorkHistory",
  "Vendor",
  "Replant",
  "Complaint",
  "File",
]);

type AuditAction = "INSERT" | "UPDATE" | "DELETE";

// diffにはPrismaのDecimal/Dateなど、Jsonカラムがそのまま受け付けない型が
// 混じり得るため、JSON往復させてプレーンなJSON値に変換してから保存する
// (Decimal/DateはどちらもtoJSON()を持つため、文字列として安全にシリアライズされる)。
function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * DBトリガーではなくアプリ層(Prismaクエリ拡張)でINSERT/UPDATE/DELETEを
 * audit_logテーブルへ記録する。トリガーにしないのは、デバッグ時に
 * 「なぜこの行が増えたか」をアプリのコードだけで追えるようにするため。
 *
 * 既知の制約: $transaction内で実行された操作の監査ログ書き込みは、
 * 監査専用の別クライアント(auditWriter)を使うため、囲んでいるトランザクション
 * 自体がロールバックしても監査ログ側はロールバックされない
 * (ごく稀な整合性の妥協。ポートフォリオ規模ではトリガー化のコストに見合わないため許容)。
 */
export function createAuditExtension(auditWriter: PrismaClient) {
  return Prisma.defineExtension({
    name: "auditLog",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "INSERT", { after: result });
          }
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "UPDATE", { after: result });
          }
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "DELETE", { before: result });
          }
          return result;
        },
      },
    },
  });
}

function extractId(result: unknown): string {
  return (result as { id: string }).id;
}

async function writeAuditLog(
  auditWriter: PrismaClient,
  tableName: string,
  recordId: string,
  action: AuditAction,
  diff: Record<string, unknown>
) {
  try {
    await auditWriter.auditLog.create({
      data: {
        tableName,
        recordId,
        action,
        changedByUserId: getAuditUserId(),
        diff: toJsonSafe(diff),
      },
    });
  } catch (e) {
    // 監査ログの記録失敗で本来の業務処理まで失敗させたくないため、ここは握りつぶしてログのみ出す。
    console.error("監査ログの記録に失敗しました:", e);
  }
}
