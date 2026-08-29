import type { FieldConfig } from "./fields";
import { TreeSelect } from "./TreeSelect";
import { VendorSelect } from "./VendorSelect";
import { FileSelect } from "./FileSelect";

export type FormValues = Record<string, string | boolean | null>;

// 日付列はバックエンドから"2026-08-28T00:00:00.000Z"のような完全なISO文字列で返るため、
// <input type="date">に渡せる"YYYY-MM-DD"へ切り詰める。
export function toDateInputValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

export function initialFormValues(fields: FieldConfig[], record: Record<string, unknown> | undefined): FormValues {
  const values: FormValues = {};
  const isCreate = !record;
  for (const field of fields) {
    const raw = record?.[field.key];
    if (field.type === "checkbox") {
      values[field.key] = typeof raw === "boolean" ? raw : false;
    } else if (field.type === "date") {
      values[field.key] = toDateInputValue(raw);
    } else if (raw == null && isCreate && field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    } else {
      values[field.key] = raw == null ? "" : String(raw);
    }
  }
  return values;
}

// 空文字は「未入力」の意図でnullとして送る(必須でない項目を空にしたケースを
// 空文字のまま保存せず、DB上もNULLとして扱うため)。
export function toSubmitPayload(fields: FieldConfig[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === "checkbox") {
      payload[field.key] = Boolean(value);
    } else if (value === "" || value === null) {
      payload[field.key] = null;
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string | boolean | null;
  onChange: (value: string | boolean | null) => void;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={3}
        />
      );
    case "number":
      return (
        <input
          type="number"
          step={field.step ?? "any"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "select":
      return (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required}>
          <option value="">(未選択)</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "treeSelect":
      return (
        <TreeSelect value={(value as string) || null} onChange={(v) => onChange(v)} required={field.required} />
      );
    case "vendorSelect":
      return (
        <VendorSelect value={(value as string) || null} onChange={(v) => onChange(v)} required={field.required} />
      );
    case "file":
      return <FileSelect value={(value as string) || null} onChange={(v) => onChange(v)} required={field.required} />;
    case "text":
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}
