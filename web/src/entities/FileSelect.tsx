import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { FileMeta } from "../lib/types";

// 診断カルテ(PDF)のような単一ファイル添付用。ファイル選択と同時に/api/filesへ
// アップロードし、返ってきたFile.idをそのままフィールド値として保持する
// (フォームの他項目と同じタイミングで保存されるtreeId等とは異なり、
// アップロード自体は選択直後に完了させる方が「保存押し忘れでファイルが消える」
// 事故を避けられるため)。
export function FileSelect({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: file } = useQuery({
    queryKey: ["files", value],
    queryFn: async () => {
      const res = await api.get<FileMeta>(`/files/${value}`);
      return res.data;
    },
    enabled: !!value,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      // Content-Typeを明示するとboundaryが付かず送信できなくなるため、
      // axiosにFormDataを渡して自動設定させる。
      const res = await api.post<FileMeta>("/files", formData);
      onChange(res.data.id);
    } catch {
      setError("アップロードに失敗しました。");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    const res = await api.get(`/files/${file.id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.originalFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="file-select">
      {file && (
        <div className="file-select-current">
          <button type="button" className="file-select-download" onClick={handleDownload}>
            {file.originalFilename}
          </button>
          <button type="button" className="file-select-clear" onClick={() => onChange(null)} aria-label="添付解除">
            ×
          </button>
        </div>
      )}
      {!file && (
        <input type="file" onChange={handleFileChange} required={required} disabled={uploading} />
      )}
      {uploading && <span className="file-select-uploading">アップロード中...</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
