import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Paginated } from "../lib/types";

export type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  treeId?: string;
  [key: string]: string | number | undefined;
};

// 7エンティティで同じ一覧/取得/作成/更新/削除パターンを手書きすると差分バグが出やすいため、
// バックエンドのcreateCrudRouter(api/src/crud.ts)と同じ発想でここに集約する。
export function createEntityQueries<T extends { id: string }>(path: string) {
  const listKey = (params: ListParams) => [path, "list", params] as const;
  const detailKey = (id: string) => [path, "detail", id] as const;

  function useList(params: ListParams = {}) {
    return useQuery({
      queryKey: listKey(params),
      queryFn: async () => {
        const res = await api.get<Paginated<T>>(path, { params });
        return res.data;
      },
    });
  }

  function useDetail(id: string | undefined) {
    return useQuery({
      queryKey: detailKey(id ?? ""),
      queryFn: async () => {
        const res = await api.get<T>(`${path}/${id}`);
        return res.data;
      },
      enabled: !!id,
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: Record<string, unknown>) => {
        const res = await api.post<T>(path, data);
        return res.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [path, "list"] });
      },
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
        const res = await api.patch<T>(`${path}/${id}`, data);
        return res.data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: [path, "list"] });
        queryClient.invalidateQueries({ queryKey: detailKey(variables.id) });
      },
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await api.delete(`${path}/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [path, "list"] });
      },
    });
  }

  return { useList, useDetail, useCreate, useUpdate, useDelete };
}
