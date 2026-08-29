import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Paginated, Tree } from "../lib/types";

// treeIdは外部キーとしてしか使われず、ユーザーがUUIDを直接入力するのは非現実的なため、
// 樹木番号でインクリメンタル検索できる簡易コンボボックスを用意する。
export function TreeSelect({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Tree[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 編集時、既に選択済みのtreeIdの表示名(樹木番号)を取得する。
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    api
      .get<Tree>(`/trees/${value}`)
      .then((res) => setSelectedLabel(`${res.data.treeNumber}${res.data.species ? `(${res.data.species})` : ""}`))
      .catch(() => setSelectedLabel(""));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      api
        .get<Paginated<Tree>>("/trees", { params: { q: query, pageSize: 8 } })
        .then((res) => setOptions(res.data.data))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="tree-select" ref={containerRef}>
      <input
        type="text"
        placeholder="樹木番号で検索..."
        value={open ? query : selectedLabel}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        required={required && !value}
      />
      {value && !open && (
        <button type="button" className="tree-select-clear" onClick={() => onChange(null)} aria-label="選択解除">
          ×
        </button>
      )}
      {open && (
        <ul className="tree-select-options">
          {options.length === 0 && <li className="tree-select-empty">該当する樹木がありません</li>}
          {options.map((tree) => (
            <li
              key={tree.id}
              onClick={() => {
                onChange(tree.id);
                setSelectedLabel(`${tree.treeNumber}${tree.species ? `(${tree.species})` : ""}`);
                setOpen(false);
              }}
            >
              {tree.treeNumber}
              {tree.species ? `(${tree.species})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
