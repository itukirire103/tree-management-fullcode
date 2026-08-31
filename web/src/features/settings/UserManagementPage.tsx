import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_LABELS, type Role } from "../../lib/types";
import { VendorSelect } from "../../entities/VendorSelect";

type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  vendorId: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
};

// system_adminはここでは付与できない(権限マトリクス編集と同様、コード側で固定の扱い)。
const ASSIGNABLE_ROLES: Role[] = ["facility_admin", "ward_staff", "contractor", "partner_admin", "readonly_other"];

type FormState = {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  vendorId: string | null;
};

const EMPTY_FORM: FormState = { email: "", password: "", displayName: "", role: "ward_staff", vendorId: null };

// 機能要件#2: アカウントの登録・変更・停止をシステム管理者が行う画面。
export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["users", "all"],
    queryFn: async () => (await api.get<{ data: ManagedUser[] }>("/users/all")).data.data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users", "all"] });

  const createUser = useMutation({
    mutationFn: async (payload: FormState) => {
      await api.post("/users", payload);
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setCreateError(null);
      invalidate();
    },
    onError: () => setCreateError("作成に失敗しました。メールアドレスの重複や入力内容を確認してください。"),
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data: patch }: { id: string; data: Record<string, unknown> }) => {
      await api.patch(`/users/${id}`, patch);
    },
    onSuccess: invalidate,
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createUser.mutateAsync(form);
  };

  const handleSetPassword = async (id: string) => {
    const password = passwordDrafts[id];
    if (!password) return;
    await updateUser.mutateAsync({ id, data: { password } });
    setPasswordDrafts((prev) => ({ ...prev, [id]: "" }));
  };

  if (isLoading) return <div className="page-loading">読み込み中...</div>;

  return (
    <div className="user-management-page">
      <h1>アカウント管理</h1>
      <p className="page-description">
        利用者アカウントの登録・ロール変更・停止(無効化)を行います。システム管理者(system_admin)は
        ロックアウト防止のためこの画面からは付与・変更できません。
      </p>

      <form className="user-create-form" onSubmit={handleCreate}>
        <h2>新規アカウント登録</h2>
        <div className="user-create-form-grid">
          <label>
            メールアドレス
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label>
            表示名
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              required
            />
          </label>
          <label>
            初期パスワード
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </label>
          <label>
            ロール
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {(form.role === "contractor" || form.role === "partner_admin") && (
            <label>
              所属事業者
              <VendorSelect value={form.vendorId} onChange={(v) => setForm((f) => ({ ...f, vendorId: v }))} />
            </label>
          )}
        </div>
        {createError && <p className="form-error">{createError}</p>}
        <button type="submit" disabled={createUser.isPending}>
          登録
        </button>
      </form>

      <table className="entity-table">
        <thead>
          <tr>
            <th>表示名</th>
            <th>メールアドレス</th>
            <th>ロール</th>
            <th>MFA</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id}>
              <td>{u.displayName}</td>
              <td>{u.email}</td>
              <td>
                {u.role === "system_admin" || u.id === currentUser?.id ? (
                  ROLE_LABELS[u.role]
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => updateUser.mutate({ id: u.id, data: { role: e.target.value } })}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>{u.mfaEnabled ? "有効" : "-"}</td>
              <td>{u.isActive ? "有効" : "停止中"}</td>
              <td className="entity-row-actions">
                {u.role !== "system_admin" && u.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => updateUser.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                  >
                    {u.isActive ? "停止する" : "再開する"}
                  </button>
                )}
                <button type="button" onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                  パスワード再設定
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId && (
        <div className="user-password-reset">
          <label>
            新しいパスワード(8文字以上)
            <input
              type="text"
              value={passwordDrafts[editingId] ?? ""}
              onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [editingId]: e.target.value }))}
              minLength={8}
            />
          </label>
          <button type="button" onClick={() => handleSetPassword(editingId)}>
            設定する
          </button>
        </div>
      )}
    </div>
  );
}
