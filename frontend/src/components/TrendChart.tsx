import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

const METRICS: { key: keyof TrendPoint; labelKey: string; color: string }[] = [
  { key: "npl", labelKey: "col_npl", color: "#e74c3c" },
  { key: "llr", labelKey: "col_llr", color: "#2ecc71" },
  { key: "ldr", labelKey: "col_ldr", color: "#3498db" },
  { key: "tangTruongDoanhThu", labelKey: "metric_growth_revenue", color: "#f39c12" },
];

function TrendLines({ activeMetrics, labels }: { activeMetrics: Set<string>; labels: Record<string, string> }) {
  return (
    <>
      {METRICS.map((m) => (
        <Line
          key={m.key}
          type="monotone"
          dataKey={m.key}
          name={labels[m.key]}
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
  labels,
  onToggle,
}: {
  activeMetrics: Set<string>;
  labels: Record<string, string>;
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
          <span style={{ color: m.color }}>{labels[m.key]}</span>
        </label>
      ))}
    </div>
  );
}

export function TrendChart({ selectedBank, selectedPeriod }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(METRICS.map((m) => m.key as string))
  );

  const labels = Object.fromEntries(METRICS.map((m) => [m.key, t(m.labelKey)]));

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
    return <p>{t("trend_select_bank")}</p>;
  }
  if (loading) return <p>{t("loading")}</p>;
  if (error) return <p>{t("error_load")}</p>;
  if (!data) return null;

  const isQuarterly = selectedPeriod !== null && selectedPeriod.quarter !== 0;
  const showAnnual = !isQuarterly;
  const showQuarterly = isQuarterly;

  return (
    <div>
      <MetricToggles activeMetrics={activeMetrics} labels={labels} onToggle={toggleMetric} />

      {showAnnual && (
        <>
          <h3>{t("trend_annual_title", { bank: selectedBank })}</h3>
          {data.annual.length === 0 ? (
            <p>{t("trend_no_annual_data")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.annual}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0f1b35", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} labelStyle={{ color: "#dde9ff", fontWeight: 600 }} />
                <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                <TrendLines activeMetrics={activeMetrics} labels={labels} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}

      {showQuarterly && (
        <>
          <h3>{t("trend_quarterly_title", { bank: selectedBank })}</h3>
          {data.quarterly.length === 0 ? (
            <p>{t("trend_no_quarterly_data")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.quarterly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis tick={{ fill: "rgba(210,225,255,0.45)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0f1b35", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} labelStyle={{ color: "#dde9ff", fontWeight: 600 }} />
                <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                <TrendLines activeMetrics={activeMetrics} labels={labels} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}
