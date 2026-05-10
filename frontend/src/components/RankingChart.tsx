import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchRankingHistory } from "../api/client";
import type { Period } from "../api/client";

interface RawRow {
  year: number;
  quarter: number;
  stockCode: string;
  totalDiem: number;
}

interface ChartPoint {
  label: string;
  [bank: string]: number | string;
}

const PALETTE = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#e91e63", "#00bcd4",
  "#8bc34a", "#ff5722", "#607d8b", "#795548", "#ffc107",
];

function periodLabel(year: number, quarter: number) {
  return quarter === 0 ? `${year}` : `${year}-Q${quarter}`;
}

function periodSort(year: number, quarter: number) {
  return year * 10 + (quarter === 0 ? 5 : quarter);
}

interface Props {
  selectedPeriod: Period | null;
}

export function RankingChart({ selectedPeriod }: Props) {
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetchRankingHistory(controller.signal)
      .then((res: any) => {
        const rows: RawRow[] = (res.data ?? []).map((r: any) => ({
          ...r,
          totalDiem: Number(r.totalDiem),
        }));
        setRaw(rows);

        const finalScore: Record<string, number> = {};
        for (const r of rows) {
          finalScore[r.stockCode] = (finalScore[r.stockCode] ?? 0) + r.totalDiem;
        }
        const top5 = Object.entries(finalScore)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([code]) => code);
        setSelectedBanks(new Set(top5));
      })
      .catch((err: any) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // All sorted periods from raw data
  const allPeriods = useMemo(() => {
    const seen = new Map<string, { year: number; quarter: number; sort: number }>();
    for (const r of raw) {
      const key = periodLabel(r.year, r.quarter);
      if (!seen.has(key))
        seen.set(key, { year: r.year, quarter: r.quarter, sort: periodSort(r.year, r.quarter) });
    }
    return [...seen.values()].sort((a, b) => a.sort - b.sort);
  }, [raw]);

  // Filter periods up to selectedPeriod
  const periods = useMemo(() => {
    if (!selectedPeriod) return allPeriods;
    const cutoff = periodSort(selectedPeriod.year, selectedPeriod.quarter);
    return allPeriods.filter((p) => p.sort <= cutoff);
  }, [allPeriods, selectedPeriod]);

  const allBanks = useMemo(() => {
    const finalScore: Record<string, number> = {};
    for (const r of raw) {
      finalScore[r.stockCode] = (finalScore[r.stockCode] ?? 0) + r.totalDiem;
    }
    return Object.entries(finalScore)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);
  }, [raw]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const lookup: Record<string, Record<string, number>> = {};
    for (const r of raw) {
      const key = periodLabel(r.year, r.quarter);
      if (!lookup[key]) lookup[key] = {};
      lookup[key][r.stockCode] = r.totalDiem;
    }

    const cumulative: Record<string, number> = {};
    return periods.map(({ year, quarter }) => {
      const key = periodLabel(year, quarter);
      const point: ChartPoint = { label: key };
      for (const bank of allBanks) {
        cumulative[bank] = (cumulative[bank] ?? 0) + (lookup[key]?.[bank] ?? 0);
        point[bank] = cumulative[bank];
      }
      return point;
    });
  }, [raw, periods, allBanks]);

  const toggleBank = (code: string) => {
    setSelectedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (loading) return <p>Đang tải…</p>;
  if (error) return <p>Lỗi tải dữ liệu</p>;
  if (chartData.length === 0) return <p>Không có dữ liệu</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {allBanks.map((code, i) => (
          <label key={code} style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedBanks.has(code)}
              onChange={() => toggleBank(code)}
            />
            <span style={{ color: PALETTE[i % PALETTE.length] }}>{code}</span>
          </label>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="label" tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
          <YAxis tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const sorted = [...payload]
                .filter((p) => !p.hide && p.value != null)
                .sort((a, b) => (b.value as number) - (a.value as number));
              return (
                <div style={{ background: "#0f1b35", border: "1px solid rgba(255,255,255,0.12)", padding: "0.5rem 0.75rem", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: 600, color: "#dde9ff" }}>{label}</p>
                  {sorted.map((p) => (
                    <p key={p.dataKey as string} style={{ margin: "0.1rem 0", color: p.color, fontSize: "0.84rem" }}>
                      {String(p.dataKey)}: {p.value}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          {allBanks.map((code, i) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              stroke={PALETTE[i % PALETTE.length]}
              hide={!selectedBanks.has(code)}
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
