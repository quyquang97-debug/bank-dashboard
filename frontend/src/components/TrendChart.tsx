import { useEffect, useState } from "react";
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
import { fetchTrend } from "../api/client";
import type { Period } from "../api/client";

interface TrendPoint {
  year: number;
  quarter: number;
  label: string;
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number | null;
}

interface TrendData {
  annual: TrendPoint[];
  quarterly: TrendPoint[];
}

interface Props {
  selectedBank: string | null;
  selectedPeriod: Period | null;
}

const METRICS: { key: keyof TrendPoint; label: string; color: string }[] = [
  { key: "npl", label: "NPL", color: "#e74c3c" },
  { key: "llr", label: "LLR", color: "#2ecc71" },
  { key: "ldr", label: "LDR", color: "#3498db" },
  { key: "tangTruongDoanhThu", label: "Tăng Trưởng DT", color: "#f39c12" },
];

function TrendLines({ activeMetrics }: { activeMetrics: Set<string> }) {
  return (
    <>
      {METRICS.map((m) => (
        <Line
          key={m.key}
          type="monotone"
          dataKey={m.key}
          name={m.label}
          stroke={m.color}
          hide={!activeMetrics.has(m.key)}
          strokeWidth={2.5}
          connectNulls={false}
          dot={true}
        />
      ))}
    </>
  );
}

function MetricToggles({
  activeMetrics,
  onToggle,
}: {
  activeMetrics: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
      {METRICS.map((m) => (
        <label key={m.key} style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={activeMetrics.has(m.key)}
            onChange={() => onToggle(m.key)}
          />
          <span style={{ color: m.color }}>{m.label}</span>
        </label>
      ))}
    </div>
  );
}

export function TrendChart({ selectedBank, selectedPeriod }: Props) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(METRICS.map((m) => m.key as string))
  );

  useEffect(() => {
    if (!selectedBank) return;
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError(false);
    fetchTrend(selectedBank, selectedPeriod ?? undefined, controller.signal)
      .then((res: any) => setData(res))
      .catch((err: any) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selectedBank, selectedPeriod]);

  const toggleMetric = (key: string) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!selectedBank) {
    return <p>Chọn một ngân hàng từ danh sách để xem xu hướng</p>;
  }
  if (loading) return <p>Đang tải…</p>;
  if (error) return <p>Lỗi tải dữ liệu</p>;
  if (!data) return null;

  const isQuarterly = selectedPeriod !== null && selectedPeriod.quarter !== 0;
  const showAnnual = !isQuarterly;
  const showQuarterly = isQuarterly;

  return (
    <div>
      <MetricToggles activeMetrics={activeMetrics} onToggle={toggleMetric} />

      {showAnnual && (
        <>
          <h3>Xu hướng theo năm — {selectedBank}</h3>
          {data.annual.length === 0 ? (
            <p>Chưa có dữ liệu báo cáo năm</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.annual}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <TrendLines activeMetrics={activeMetrics} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}

      {showQuarterly && (
        <>
          <h3>Xu hướng theo quý — {selectedBank}</h3>
          {data.quarterly.length === 0 ? (
            <p>Chưa có dữ liệu báo cáo quý</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.quarterly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <TrendLines activeMetrics={activeMetrics} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}
