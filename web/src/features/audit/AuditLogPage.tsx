import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Paginated } from "../../lib/types";

type AuditLogEntry = {
  id: string;
  tableName: string;
  recordId: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  changedAt: string;
  diff: unknown;
  changedByUser: { id: string; displayName: string; email: string } | null;
};

const ACTION_LABELS: Record<AuditLogEntry["action"], string> = {
  INSERT: "作成",
  UPDATE: "更新",
  DELETE: "削除",
};

const PAGE_SIZE = 30;

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [tableName, setTableName] = useState("");
  const [action, setAction] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", { page, tableName, action }],
    queryFn: async () => {
      const res = await api.get<Paginated<AuditLogEntry>>("/audit-logs", {
        params: { page, pageSize: PAGE_SIZE, tableName: tableName || undefined, action: action || undefined },
      });
      return res.data;
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="audit-log-page">
      <h1>監査ログ</h1>
      <p className="page-description">全ドメインテーブルのINSERT/UPDATE/DELETEの記録です。行をクリックすると変更内容を表示します。</p>

      <div className="audit-log-filters">
        <select
          value={tableName}
          onChange={(e) => {
            setTableName(e.target.value);
            setPage(1);
          }}
        >
          <option value="">(すべてのテーブル)</option>
          {["Tree", "Diagnosis", "Inspection", "WorkHistory", "Vendor", "Replant", "Complaint", "File"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">(すべての操作)</option>
          <option value="INSERT">作成</option>
          <option value="UPDATE">更新</option>
          <option value="DELETE">削除</option>
        </select>
      </div>

      {isLoading ? (
        <div className="page-loading">読み込み中...</div>
      ) : (
        <>
          <table className="entity-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>テーブル</th>
                <th>操作</th>
                <th>対象ID</th>
                <th>実行者</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="audit-log-row"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td>{new Date(entry.changedAt).toLocaleString("ja-JP")}</td>
                    <td>{entry.tableName}</td>
                    <td>{ACTION_LABELS[entry.action]}</td>
                    <td className="audit-log-record-id">{entry.recordId}</td>
                    <td>{entry.changedByUser?.displayName ?? "-"}</td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="audit-log-diff-row">
                      <td colSpan={5}>
                        <pre>{JSON.stringify(entry.diff, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5}>データがありません。</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              前へ
            </button>
            <span>
              {page} / {totalPages} ページ(全{data?.total ?? 0}件)
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              次へ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
