import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { EntityDef } from "./config";
import { toDateInputValue } from "./FieldInput";

const PAGE_SIZE = 20;

export function EntityListPage<T extends { id: string }>({
  entity,
  newLinkSuffix = "",
  rowLinkLabel = "編集",
}: {
  entity: EntityDef<T>;
  newLinkSuffix?: string;
  // Treeのみ{path}/{id}が編集フォームではなく詳細ページ(TreeDetailPage)を指すため、
  // ラベルを「詳細」に差し替えられるようにしている。
  rowLinkLabel?: string;
}) {
  const [searchParams] = useSearchParams();
  const treeId = searchParams.get("treeId") ?? undefined;
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const { data, isLoading } = entity.queries.useList({ page, pageSize: PAGE_SIZE, treeId, q: q || undefined });
  const deleteMutation = entity.queries.useDelete();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleDelete = async (id: string) => {
    if (!confirm("削除してよろしいですか?(論理削除のため復元は管理者に依頼してください)")) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="entity-list-page">
      <div className="entity-list-header">
        <h1>{entity.label}一覧</h1>
        <Link to={`new${newLinkSuffix}`} className="button-primary">
          + 新規作成
        </Link>
      </div>
      {entity.path === "/trees" && (
        <input
          className="search-box"
          type="text"
          placeholder="樹木番号で検索..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      )}
      {isLoading ? (
        <div className="page-loading">読み込み中...</div>
      ) : (
        <>
          <table className="entity-table">
            <thead>
              <tr>
                {entity.listColumns.map((col) => (
                  <th key={col}>{entity.fields.find((f) => f.key === col)?.label ?? col}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((row) => (
                <tr key={row.id}>
                  {entity.listColumns.map((col) => (
                    <td key={col}>{formatCell(row as Record<string, unknown>, col, entity)}</td>
                  ))}
                  <td className="entity-row-actions">
                    <Link to={`${row.id}`}>{rowLinkLabel}</Link>
                    <button type="button" onClick={() => handleDelete(row.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={entity.listColumns.length + 1}>データがありません。</td>
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

function formatCell<T extends { id: string }>(row: Record<string, unknown>, col: string, entity: EntityDef<T>): string {
  const field = entity.fields.find((f) => f.key === col);
  const raw = row[col];
  if (raw == null) return "-";
  if (field?.type === "date") return toDateInputValue(raw);
  if (field?.type === "checkbox") return raw ? "はい" : "いいえ";
  if (field?.type === "select") {
    const label = field.options?.find((o) => o.value === raw)?.label;
    return label ?? String(raw);
  }
  return String(raw);
}
