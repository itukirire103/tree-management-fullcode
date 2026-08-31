import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../lib/api";
import type { CalendarEvent } from "../../lib/types";

const CATEGORY_LABELS: Record<CalendarEvent["category"], string> = {
  complaint: "苦情・要望",
  schedule: "点検・作業予定",
  workHistory: "作業実績",
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 月グリッド表示のため、月初/月末に前後月の日付を足して6週×7日=42マスに揃える。
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// 機能要件#13: 陳情・作業の予定・進捗状況・履歴をカレンダーで確認できること。
export function CalendarPage() {
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const grid = useMemo(() => buildMonthGrid(monthStart), [monthStart]);
  const from = toDateKey(grid[0]);
  const to = toDateKey(grid[grid.length - 1]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: async () => {
      const res = await api.get<{ data: CalendarEvent[] }>("/calendar", { params: { from, to } });
      return res.data.data;
    },
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of data ?? []) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [data]);

  const monthLabel = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;
  const todayKey = toDateKey(new Date());

  return (
    <div className="calendar-page">
      <div className="entity-list-header">
        <h1>カレンダー</h1>
        <div className="calendar-nav">
          <button type="button" onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>
            前月
          </button>
          <span className="calendar-month-label">{monthLabel}</span>
          <button type="button" onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>
            次月
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            今月
          </button>
        </div>
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-item calendar-cat-complaint">苦情・要望</span>
        <span className="calendar-legend-item calendar-cat-schedule">点検・作業予定</span>
        <span className="calendar-legend-item calendar-cat-workHistory">作業実績</span>
      </div>

      {isLoading ? (
        <div className="page-loading">読み込み中...</div>
      ) : (
        <div className="calendar-grid">
          {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
            <div key={w} className="calendar-weekday">
              {w}
            </div>
          ))}
          {grid.map((d) => {
            const key = toDateKey(d);
            const events = eventsByDate.get(key) ?? [];
            const inMonth = d.getMonth() === monthStart.getMonth();
            return (
              <button
                type="button"
                key={key}
                className={`calendar-cell${inMonth ? "" : " calendar-cell-outside"}${key === todayKey ? " calendar-cell-today" : ""}${
                  key === selectedDate ? " calendar-cell-selected" : ""
                }`}
                onClick={() => setSelectedDate(key)}
              >
                <span className="calendar-cell-date">{d.getDate()}</span>
                <span className="calendar-cell-events">
                  {events.slice(0, 3).map((ev) => (
                    <span key={ev.id} className={`calendar-dot calendar-cat-${ev.category}`} />
                  ))}
                  {events.length > 3 && <span className="calendar-more">+{events.length - 3}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedDate && (
        <div className="calendar-day-detail">
          <h2>{selectedDate}</h2>
          {(eventsByDate.get(selectedDate) ?? []).length === 0 ? (
            <p>この日の予定・記録はありません。</p>
          ) : (
            <ul>
              {(eventsByDate.get(selectedDate) ?? []).map((ev) => (
                <li key={ev.id}>
                  <span className={`calendar-dot calendar-cat-${ev.category}`} />
                  <span className="calendar-day-detail-category">{CATEGORY_LABELS[ev.category]}</span>
                  <Link to={ev.path}>{ev.label}</Link>
                  {ev.subLabel && <span className="calendar-day-detail-sublabel">{ev.subLabel}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
