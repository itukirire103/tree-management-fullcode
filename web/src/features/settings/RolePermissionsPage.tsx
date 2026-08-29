import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ROLE_LABELS, type Role } from "../../lib/types";
import {
  complaintEntity,
  diagnosisEntity,
  inspectionEntity,
  replantEntity,
  treeEntity,
  vendorEntity,
  workHistoryEntity,
} from "../../entities/config";

type Action = "create" | "read" | "update" | "delete";
type Scope = "global" | "area" | "own" | "none";
type PermissionRow = { entity: string; role: Role; action: Action; scope: Scope };

// system_admin以外の5ロール。system_adminは常にフル権限固定でAPIも一覧に含めない。
const ROLE_ORDER: Role[] = ["facility_admin", "ward_staff", "contractor", "partner_admin", "readonly_other"];

const ENTITY_ORDER = ["tree", "diagnosis", "inspection", "workHistory", "replant", "complaint", "vendor"];
const ENTITY_LABELS: Record<string, string> = {
  tree: treeEntity.label,
  diagnosis: diagnosisEntity.label,
  inspection: inspectionEntity.label,
  workHistory: workHistoryEntity.label,
  replant: replantEntity.label,
  complaint: complaintEntity.label,
  vendor: vendorEntity.label,
};

const ACTION_ORDER: Action[] = ["create", "read", "update", "delete"];
const ACTION_LABELS: Record<Action, string> = { create: "作成", read: "閲覧", update: "更新", delete: "削除" };

const SCOPE_ORDER: Scope[] = ["global", "area", "own", "none"];
const SCOPE_LABELS: Record<Scope, string> = {
  global: "組織全体",
  area: "担当エリア",
  own: "自分のみ",
  none: "なし",
};

function rowKey(row: { entity: string; role: string; action: string }): string {
  return `${row.role}:${row.entity}:${row.action}`;
}

// 機能要件#3: システム管理者がアカウント種類毎に利用権限を追加・変更できる画面。
// エンティティごとに「ロール×操作」の表を並べ、各セルでスコープを選択する。
export function RolePermissionsPage() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [dirty, setDirty] = useState<Map<string, PermissionRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: PermissionRow[] }>("/role-permissions").then((res) => {
      setRows(res.data.data);
      setLoading(false);
    });
  }, []);

  const handleChange = (row: PermissionRow, scope: Scope) => {
    const updated: PermissionRow = { ...row, scope };
    setRows((prev) => prev.map((r) => (rowKey(r) === rowKey(row) ? updated : r)));
    setDirty((prev) => new Map(prev).set(rowKey(row), updated));
  };

  const handleSave = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.patch("/role-permissions", { changes: Array.from(dirty.values()) });
      setDirty(new Map());
      setMessage("保存しました。");
    } catch {
      setMessage("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">読み込み中...</div>;

  return (
    <div className="role-permissions-page">
      <div className="entity-list-header">
        <h1>権限マトリクス編集</h1>
        <button type="button" className="button-primary" disabled={saving || dirty.size === 0} onClick={handleSave}>
          {saving ? "保存中..." : `保存(${dirty.size}件の変更)`}
        </button>
      </div>
      <p className="role-permissions-note">
        システム管理者(system_admin)は常に全エンティティで全権限を持つため、この一覧には含まれません。
      </p>
      {message && <p className="form-error">{message}</p>}

      {ENTITY_ORDER.map((entity) => (
        <section key={entity} className="role-permissions-section">
          <h2>{ENTITY_LABELS[entity]}</h2>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ロール</th>
                {ACTION_ORDER.map((action) => (
                  <th key={action}>{ACTION_LABELS[action]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ORDER.map((role) => (
                <tr key={role}>
                  <td>{ROLE_LABELS[role]}</td>
                  {ACTION_ORDER.map((action) => {
                    const row = rows.find((r) => r.entity === entity && r.role === role && r.action === action);
                    if (!row) return <td key={action}>-</td>;
                    return (
                      <td key={action}>
                        <select
                          value={row.scope}
                          onChange={(e) => handleChange(row, e.target.value as Scope)}
                        >
                          {SCOPE_ORDER.map((scope) => (
                            <option key={scope} value={scope}>
                              {SCOPE_LABELS[scope]}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
