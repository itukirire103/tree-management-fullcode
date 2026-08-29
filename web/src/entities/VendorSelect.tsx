import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Paginated, Vendor } from "../lib/types";

// 委託事業者の数は多くない想定のため、検索コンボボックスではなく単純なselectで十分。
export function VendorSelect({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["vendors", "all"],
    queryFn: async () => {
      const res = await api.get<Paginated<Vendor>>("/vendors", { params: { pageSize: 100 } });
      return res.data.data;
    },
  });

  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} required={required}>
      <option value="">(未選択)</option>
      {data?.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.vendorName}
        </option>
      ))}
    </select>
  );
}
