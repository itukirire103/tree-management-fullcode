import { Prisma, type PrismaClient } from "@prisma/client";
import { getAuditUserId } from "./context.js";

// 監査対象は業務ドメインの7テーブル+添付ファイル+権限マトリクス+アカウント管理。
// RefreshToken等の純粋なセッション管理テーブルやarea/audit_log自体は対象外。
const AUDITED_MODELS = new Set([
  "Tree",
  "Diagnosis",
  "Inspection",
  "WorkHistory",
  "Vendor",
  "Replant",
  "Complaint",
  "File",
  "RolePermission",
  "User",
]);

// UserモデルはpasswordHash/totpSecretという機密情報を持つため、他モデルと同じように
// 行全体をそのままdiffへ書き出すと監査ログにハッシュ値等が残ってしまう。
// モデルごとに除外するキーを指定できるようにし、Userだけ機密フィールドを取り除く。
const REDACTED_FIELDS: Partial<Record<string, string[]>> = {
  User: ["passwordHash", "totpSecret"],
};

type AuditAction = "INSERT" | "UPDATE" | "DELETE";

// diffにはPrismaのDecimal/Dateなど、Jsonカラムがそのまま受け付けない型が
// 混じり得るため、JSON往復させてプレーンなJSON値に変換してから保存する
// (Decimal/DateはどちらもtoJSON()を持つため、文字列として安全にシリアライズされる)。
function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function redact(model: string, record: unknown): unknown {
  const fields = REDACTED_FIELDS[model];
  if (!fields || typeof record !== "object" || record === null) return record;
  const clone = { ...(record as Record<string, unknown>) };
  for (const field of fields) delete clone[field];
  return clone;
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
            await writeAuditLog(auditWriter, model, extractId(result), "INSERT", { after: redact(model, result) });
          }
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "UPDATE", { after: redact(model, result) });
          }
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "DELETE", { before: redact(model, result) });
          }
          return result;
        },
        // role-permissionsルートの権限マトリクス更新でupsertを使うために追加。
        // 作成/更新どちらでも意味的には「値が変わった」ことに変わりないため、UPDATEとして記録する。
        async upsert({ model, args, query }) {
          const result = await query(args);
          if (AUDITED_MODELS.has(model)) {
            await writeAuditLog(auditWriter, model, extractId(result), "UPDATE", { after: redact(model, result) });
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
