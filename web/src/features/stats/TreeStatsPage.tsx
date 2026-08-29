import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type SpeciesCount = { species: string; count: number };
type TreeStats = {
  bySpecies: SpeciesCount[];
  plantedCount: number;
  plantedBySpecies: SpeciesCount[];
  removedCount: number;
};

// 機能要件#20: 指定期間の樹木数量(樹種毎の本数、植樹本数、伐採本数)を集計表示する。
export function TreeStatsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tree-stats", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<TreeStats>("/trees/stats", {
        params: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
      });
      return res.data;
    },
  });

  return (
    <div className="tree-stats-page">
      <h1>樹木数量集計</h1>
      <div className="date-range-filter">
        <label>
          期間(開始)
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          期間(終了)
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      {isLoading && <div className="page-loading">読み込み中...</div>}

      {data && (
        <>
          <div className="stats-summary">
            <div className="stats-card">
              <span className="stats-card-label">指定期間の植樹本数</span>
              <span className="stats-card-value">{data.plantedCount}本</span>
            </div>
            <div className="stats-card">
              <span className="stats-card-label">指定期間の伐採本数</span>
              <span className="stats-card-value">{data.removedCount}本</span>
            </div>
          </div>

          <section>
            <h2>樹種別本数(現存する樹木)</h2>
            <table className="entity-table">
              <thead>
                <tr>
                  <th>樹種</th>
                  <th>本数</th>
                </tr>
              </thead>
              <tbody>
                {data.bySpecies.map((row) => (
                  <tr key={row.species}>
                    <td>{row.species}</td>
                    <td>{row.count}本</td>
                  </tr>
                ))}
                {data.bySpecies.length === 0 && (
                  <tr>
                    <td colSpan={2}>データがありません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h2>指定期間の植樹本数(樹種別内訳)</h2>
            <table className="entity-table">
              <thead>
                <tr>
                  <th>樹種</th>
                  <th>本数</th>
                </tr>
              </thead>
              <tbody>
                {data.plantedBySpecies.map((row) => (
                  <tr key={row.species}>
                    <td>{row.species}</td>
                    <td>{row.count}本</td>
                  </tr>
                ))}
                {data.plantedBySpecies.length === 0 && (
                  <tr>
                    <td colSpan={2}>データがありません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
