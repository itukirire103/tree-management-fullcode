import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import type { EntityDef } from "./config";
import { FieldInput, initialFormValues, toSubmitPayload, type FormValues } from "./FieldInput";
import { PhotoManager } from "./PhotoManager";

// 樹木詳細ページから「この樹木の診断を追加」のように遷移してきた場合、
// treeId等をクエリパラメータで固定値として渡し、フォーム上には出さずに送信する。
export function EntityFormPage<T extends { id: string }>({
  entity,
  fixedFieldKeys = [],
  backTo,
}: {
  entity: EntityDef<T>;
  fixedFieldKeys?: string[];
  backTo?: string;
}) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: record, isLoading } = entity.queries.useDetail(id);
  const createMutation = entity.queries.useCreate();
  const updateMutation = entity.queries.useUpdate();

  const [values, setValues] = useState<FormValues>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && !record) return;
    const base = initialFormValues(entity.fields, record as Record<string, unknown> | undefined);
    for (const key of fixedFieldKeys) {
      const paramValue = searchParams.get(key);
      if (paramValue) base[key] = paramValue;
    }
    setValues(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, isEdit]);

  if (isEdit && isLoading) return <div className="page-loading">読み込み中...</div>;

  const visibleFields = entity.fields.filter((f) => !fixedFieldKeys.includes(f.key) || !searchParams.get(f.key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = toSubmitPayload(entity.fields, values);
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate(backTo ?? entity.path);
    } catch {
      setError("保存に失敗しました。入力内容を確認してください。");
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="entity-form-page">
      <h1>
        {entity.label} {isEdit ? "編集" : "新規作成"}
      </h1>
      <form onSubmit={handleSubmit}>
        {visibleFields.map((field) => (
          <label key={field.key} className={`field field-${field.type}`}>
            <span>
              {field.label}
              {field.required && <span className="required-mark">*</span>}
            </span>
            <FieldInput
              field={field}
              value={values[field.key] ?? (field.type === "checkbox" ? false : "")}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
            />
          </label>
        ))}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "保存中..." : "保存"}
          </button>
          <button type="button" onClick={() => navigate(-1)}>
            キャンセル
          </button>
        </div>
      </form>
      {isEdit && id && entity.photoConfig && (
        <PhotoManager
          apiPath={`${entity.path}/${id}/photos`}
          label={entity.photoConfig.label}
          maxCount={entity.photoConfig.maxCount}
        />
      )}
    </div>
  );
}
