import { Link, useNavigate, useParams } from "react-router";
import { treeEntity, TREE_LINKED_ENTITIES } from "../../entities/config";
import { HEALTH_STATUS_LABELS, TREE_STATUS_LABELS } from "../../lib/types";

// Dataverse版のツリーフォームのサブグリッド(診断・点検・作業履歴・苦情)に相当する、
// 樹木を起点とした関連レコード一覧をまとめて見せる詳細ページ。
export function TreeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: tree, isLoading } = treeEntity.queries.useDetail(id);
  const deleteMutation = treeEntity.queries.useDelete();

  if (isLoading || !tree) return <div className="page-loading">読み込み中...</div>;

  const handleDelete = async () => {
    if (!confirm("この樹木を削除してよろしいですか?(論理削除)")) return;
    await deleteMutation.mutateAsync(tree.id);
    navigate("/trees");
  };

  return (
    <div className="tree-detail-page">
      <div className="entity-list-header">
        <h1>
          {tree.treeNumber} {tree.species && <span className="tree-species">({tree.species})</span>}
        </h1>
        <div>
          <Link to={`/trees/${tree.id}/edit`} className="button-primary">
            編集
          </Link>
          <button type="button" onClick={handleDelete}>
            削除
          </button>
        </div>
      </div>

      <dl className="tree-summary">
        <dt>状態</dt>
        <dd>{TREE_STATUS_LABELS[tree.status]}</dd>
        <dt>健全度</dt>
        <dd>{tree.healthStatus ? HEALTH_STATUS_LABELS[tree.healthStatus] : "-"}</dd>
        <dt>所在地</dt>
        <dd>{tree.address ?? "-"}</dd>
        <dt>路線番号</dt>
        <dd>{tree.routeNumber ?? "-"}</dd>
        <dt>位置</dt>
        <dd>
          {tree.latitude}, {tree.longitude}
        </dd>
        <dt>備考</dt>
        <dd>{tree.notes ?? "-"}</dd>
      </dl>

      {TREE_LINKED_ENTITIES.map((linked) => (
        <TreeLinkedSection key={linked.key} entity={linked} treeId={tree.id} />
      ))}
    </div>
  );
}

function TreeLinkedSection({ entity, treeId }: { entity: (typeof TREE_LINKED_ENTITIES)[number]; treeId: string }) {
  const { data } = entity.queries.useList({ treeId, pageSize: 5 });

  return (
    <section className="tree-linked-section">
      <div className="entity-list-header">
        <h2>{entity.label}</h2>
        <Link to={`${entity.path}/new?treeId=${treeId}`} className="button-secondary">
          + 追加
        </Link>
      </div>
      <table className="entity-table">
        <thead>
          <tr>
            {entity.listColumns.slice(0, 3).map((col) => (
              <th key={col}>{entity.fields.find((f) => f.key === col)?.label ?? col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.data.map((row) => (
            <tr key={row.id}>
              {entity.listColumns.slice(0, 3).map((col) => (
                <td key={col}>
                  <Link to={`${entity.path}/${row.id}`}>{String((row as Record<string, unknown>)[col] ?? "-")}</Link>
                </td>
              ))}
            </tr>
          ))}
          {data?.data.length === 0 && (
            <tr>
              <td colSpan={3}>データがありません。</td>
            </tr>
          )}
        </tbody>
      </table>
      {data && data.total > 5 && (
        <Link to={`${entity.path}?treeId=${treeId}`} className="see-more-link">
          すべて見る({data.total}件)
        </Link>
      )}
    </section>
  );
}
