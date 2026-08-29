import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Area, Paginated, UserSummary, Vendor } from "../../lib/types";

export function AreasPage() {
  const queryClient = useQueryClient();
  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: async () => (await api.get<{ data: Area[] }>("/areas")).data.data,
  });
  const usersQuery = useQuery({
    queryKey: ["users", "all"],
    queryFn: async () => (await api.get<{ data: UserSummary[] }>("/users")).data.data,
  });
  const vendorsQuery = useQuery({
    queryKey: ["vendors", "all"],
    queryFn: async () => (await api.get<Paginated<Vendor>>("/vendors", { params: { pageSize: 100 } })).data.data,
  });

  const invalidateAreas = () => queryClient.invalidateQueries({ queryKey: ["areas"] });

  const createArea = useMutation({
    mutationFn: async (payload: { name: string; routeNumbers: string[] }) => {
      await api.post("/areas", payload);
    },
    onSuccess: invalidateAreas,
  });
  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/areas/${id}`);
    },
    onSuccess: invalidateAreas,
  });
  const assignUser = useMutation({
    mutationFn: async ({ areaId, userId }: { areaId: string; userId: string }) => {
      await api.post(`/areas/${areaId}/users`, { userId });
    },
    onSuccess: invalidateAreas,
  });
  const unassignUser = useMutation({
    mutationFn: async ({ areaId, userId }: { areaId: string; userId: string }) => {
      await api.delete(`/areas/${areaId}/users/${userId}`);
    },
    onSuccess: invalidateAreas,
  });
  const assignVendor = useMutation({
    mutationFn: async ({ areaId, vendorId }: { areaId: string; vendorId: string }) => {
      await api.post(`/areas/${areaId}/vendors`, { vendorId });
    },
    onSuccess: invalidateAreas,
  });
  const unassignVendor = useMutation({
    mutationFn: async ({ areaId, vendorId }: { areaId: string; vendorId: string }) => {
      await api.delete(`/areas/${areaId}/vendors/${vendorId}`);
    },
    onSuccess: invalidateAreas,
  });

  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaRoutes, setNewAreaRoutes] = useState("");

  const handleCreateArea = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await createArea.mutateAsync({
      name: newAreaName,
      routeNumbers: newAreaRoutes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setNewAreaName("");
    setNewAreaRoutes("");
  };

  return (
    <div className="areas-page">
      <h1>エリア割当て管理</h1>
      <p className="page-description">
        担当エリア(路線番号の集合)を定義し、区職員・委託事業者を割り当てます。担当エリアはRBACの参照範囲(area
        scope)の判定に使われます。
      </p>

      <form className="area-create-form" onSubmit={handleCreateArea}>
        <input
          type="text"
          placeholder="エリア名(例: 港南地区)"
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="路線番号(カンマ区切り、例: R001, R002)"
          value={newAreaRoutes}
          onChange={(e) => setNewAreaRoutes(e.target.value)}
        />
        <button type="submit" disabled={createArea.isPending}>
          エリアを追加
        </button>
      </form>

      {areasQuery.isLoading ? (
        <div className="page-loading">読み込み中...</div>
      ) : (
        <div className="area-cards">
          {areasQuery.data?.map((area) => (
            <div key={area.id} className="area-card">
              <div className="area-card-header">
                <h2>{area.name}</h2>
                <button type="button" onClick={() => deleteArea.mutate(area.id)}>
                  エリアを削除
                </button>
              </div>
              <p className="area-routes">路線番号: {area.routeNumbers.join(", ") || "(未設定)"}</p>

              <div className="area-assignment-block">
                <h3>担当職員</h3>
                <ul>
                  {area.userAreas.map((ua) => (
                    <li key={ua.userId}>
                      {ua.user.displayName}({ua.user.email})
                      <button type="button" onClick={() => unassignUser.mutate({ areaId: area.id, userId: ua.userId })}>
                        解除
                      </button>
                    </li>
                  ))}
                  {area.userAreas.length === 0 && <li className="empty-item">未割当て</li>}
                </ul>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      assignUser.mutate({ areaId: area.id, userId: e.target.value });
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">+ 職員を割り当てる...</option>
                  {usersQuery.data
                    ?.filter((u) => !area.userAreas.some((ua) => ua.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="area-assignment-block">
                <h3>委託事業者</h3>
                <ul>
                  {area.vendorAreas.map((va) => (
                    <li key={va.vendorId}>
                      {va.vendor.vendorName}
                      <button
                        type="button"
                        onClick={() => unassignVendor.mutate({ areaId: area.id, vendorId: va.vendorId })}
                      >
                        解除
                      </button>
                    </li>
                  ))}
                  {area.vendorAreas.length === 0 && <li className="empty-item">未割当て</li>}
                </ul>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      assignVendor.mutate({ areaId: area.id, vendorId: e.target.value });
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">+ 事業者を割り当てる...</option>
                  {vendorsQuery.data
                    ?.filter((v) => !area.vendorAreas.some((va) => va.vendorId === v.id))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorName}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
