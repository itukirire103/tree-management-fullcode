import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { FileMeta } from "../lib/types";

type PhotoRecord = {
  id: string;
  fileId: string;
  sortOrder: number;
  file: FileMeta;
};

// 診断結果の被害部写真・点検記録の点検写真など、レコードに複数枚の画像を
// 紐づけるための共通UI(作業前後写真=WorkHistoryPhotoと同じAPI形状を前提とする)。
// 新規作成前(idが無い状態)では紐づけ先が無いため、EntityFormPage側で
// 編集時のみ表示する。
export function PhotoManager({
  apiPath,
  label,
  maxCount,
}: {
  apiPath: string;
  label: string;
  maxCount?: number;
}) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKey = ["photos", apiPath];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<{ data: PhotoRecord[] }>(apiPath);
      return res.data.data;
    },
  });

  const photos = data ?? [];
  const reachedMax = maxCount !== undefined && photos.length >= maxCount;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      // Content-Typeを明示するとboundaryが付かず送信できなくなるため、
      // axiosにFormDataを渡して自動設定させる。
      const uploadRes = await api.post<FileMeta>("/files", formData);
      await api.post(apiPath, { fileId: uploadRes.data.id, sortOrder: photos.length });
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      setError("写真のアップロードに失敗しました。");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (photo: PhotoRecord) => {
    const res = await api.get(`/files/${photo.fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.file.originalFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="photo-manager">
      <h2>
        {label}
        {maxCount !== undefined && ` (最大${maxCount}枚)`}
      </h2>
      <ul className="photo-manager-list">
        {photos.map((photo) => (
          <li key={photo.id}>
            <button type="button" onClick={() => handleDownload(photo)}>
              {photo.file.originalFilename}
            </button>
          </li>
        ))}
        {photos.length === 0 && <li className="photo-manager-empty">写真はまだありません。</li>}
      </ul>
      {!reachedMax && <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />}
      {reachedMax && <p className="photo-manager-max">上限枚数に達しています。</p>}
      {uploading && <span className="file-select-uploading">アップロード中...</span>}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
