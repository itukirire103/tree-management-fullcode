import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { EntityDef } from "./config";
import { toDateInputValue } from "./FieldInput";
import { api } from "../lib/api";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  // 機能要件#19: 台帳の各項目ごとの絞込検索。entity.filterableFieldsに列挙されたキーのみ、
  // フィールド種別(select/checkbox/text)に応じた入力欄を出し分ける。
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});

  const { data, isLoading } = entity.queries.useList({
    page,
    pageSize: PAGE_SIZE,
    treeId,
    q: q || undefined,
    ...(entity.dateRangeFilter ? { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } : {}),
    ...fieldFilters,
  });
  const deleteMutation = entity.queries.useDelete();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleDelete = async (id: string) => {
    if (!confirm("削除してよろしいですか?(論理削除のため復元は管理者に依頼してください)")) return;
    await deleteMutation.mutateAsync(id);
  };

  // CSV/Excel/PDF出力(機能要件#11/#25)。認証ヘッダが必要なためBlobで取得し、
  // ブラウザのダウンロードとして保存させる。
  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(true);
    try {
      const path = format === "pdf" ? `${entity.path}/export/pdf` : `${entity.path}/export`;
      const params: Record<string, string> = {};
      if (format !== "pdf") params.format = format;
      if (entity.dateRangeFilter) {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      // 一覧の検索ボックス(樹木番号)による絞り込みも、出力時に無視されず
      // 画面表示中の内容と一致するようにする。
      if (entity.path === "/trees" && q) params.q = q;
      Object.assign(params, fieldFilters);
      const res = await api.get(path, { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity.key}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="entity-list-page">
      <div className="entity-list-header">
        <h1>{entity.label}一覧</h1>
        <div className="entity-list-header-actions">
          {entity.exportable && (
            <div className="export-buttons">
              <button type="button" disabled={exporting} onClick={() => handleExport("csv")}>
                CSV出力
              </button>
              <button type="button" disabled={exporting} onClick={() => handleExport("xlsx")}>
                Excel出力
              </button>
              {entity.key === "workHistory" && (
                <button type="button" disabled={exporting} onClick={() => handleExport("pdf")}>
                  作業予定簿PDF
                </button>
              )}
            </div>
          )}
          <Link to={`new${newLinkSuffix}`} className="button-primary">
            + 新規作成
          </Link>
        </div>
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
      {entity.dateRangeFilter && (
        <div className="date-range-filter">
          <label>
            期間(開始)
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            期間(終了)
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      )}
      {entity.filterableFields && entity.filterableFields.length > 0 && (
        <div className="field-filters">
          {entity.filterableFields.map((key) => {
            const field = entity.fields.find((f) => f.key === key);
            if (!field) return null;
            const value = fieldFilters[key] ?? "";
            const update = (v: string) => {
              setFieldFilters((prev) => {
                const next = { ...prev };
                if (v) next[key] = v;
                else delete next[key];
                return next;
              });
              setPage(1);
            };
            if (field.type === "select") {
              return (
                <label key={key} className="field-filter">
                  {field.label}
                  <select value={value} onChange={(e) => update(e.target.value)}>
                    <option value="">すべて</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (field.type === "checkbox") {
              return (
                <label key={key} className="field-filter">
                  {field.label}
                  <select value={value} onChange={(e) => update(e.target.value)}>
                    <option value="">すべて</option>
                    <option value="true">はい</option>
                    <option value="false">いいえ</option>
                  </select>
                </label>
              );
            }
            return (
              <label key={key} className="field-filter">
                {field.label}
                <input type="text" value={value} onChange={(e) => update(e.target.value)} placeholder="絞り込み..." />
              </label>
            );
          })}
        </div>
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
