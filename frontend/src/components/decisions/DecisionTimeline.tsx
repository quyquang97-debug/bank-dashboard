import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchDecisions } from "../../api/client";
import type { DecisionEntry } from "../../api/client";

interface Props {
  onAdd: () => void;
  onSelect: (id: number) => void;
}

const DECISION_TYPES = ["BUY", "SELL", "HOLD", "WATCH"] as const;
const ASSET_TYPES = ["STOCK", "GOLD", "CRYPTO", "SAVINGS"] as const;

function formatVND(n: number | null, assetType?: DecisionEntry["asset_type"]): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("vi-VN", {
    maximumFractionDigits: assetType && assetType !== "STOCK" ? 20 : 0,
  }) + " đ";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function DecisionTimeline({ onAdd, onSelect }: Props) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTicker, setFilterTicker] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterAssetTypes, setFilterAssetTypes] = useState<string[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchDecisions(
      {
        ticker: filterTicker || undefined,
        type: filterTypes.length ? filterTypes.join(",") : undefined,
        asset_type: filterAssetTypes.length ? filterAssetTypes.join(",") : undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      },
      ac.signal
    )
      .then((r) => setEntries(r.data))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [filterTicker, filterTypes, filterAssetTypes, filterFrom, filterTo]);

  function toggleType(type: string) {
    setFilterTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleAssetType(type: string) {
    setFilterAssetTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="decisions-view">
      {/* Filter bar */}
      <div className="decision-filter-toolbar">
        <div className="decision-filter-controls">
          <input
            type="text"
            placeholder={t("decisions.form.ticker")}
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
            className="decision-filter-ticker"
          />
          <div className="decision-filter-group">
            {DECISION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: "5px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: filterTypes.includes(type) ? "#f5c842" : "rgba(255,255,255,0.07)",
                  color: filterTypes.includes(type) ? "#0f1b35" : "inherit",
                  cursor: "pointer",
                  fontWeight: filterTypes.includes(type) ? 700 : 400,
                  fontSize: "0.82rem",
                }}
              >
                {t(`decisions.type.${type.toLowerCase()}`)}
              </button>
            ))}
          </div>
          <div className="decision-filter-group">
            {ASSET_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleAssetType(type)}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: "5px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: filterAssetTypes.includes(type) ? "#a78bfa" : "rgba(255,255,255,0.07)",
                  color: filterAssetTypes.includes(type) ? "#0f1b35" : "inherit",
                  cursor: "pointer",
                  fontWeight: filterAssetTypes.includes(type) ? 700 : 400,
                  fontSize: "0.82rem",
                }}
              >
                {t(`decisions.asset_type.${type.toLowerCase()}`)}
              </button>
            ))}
          </div>
          <div className="decision-date-range">
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <span aria-hidden="true">→</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
        </div>
        <button className="decision-add-button" onClick={onAdd} style={{
          padding: "0.45rem 1.1rem", borderRadius: "7px",
          background: "#f5c842", color: "#0f1b35", border: "none", cursor: "pointer", fontWeight: 700,
        }}>
          {t("decisions.btn_add")}
        </button>
      </div>

      {/* Table */}
      {loading && <p style={{ opacity: 0.5 }}>{t("decisions.loading")}</p>}
      {error && <p style={{ color: "#ff6b6b" }}>{t("error_load")}: {error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p style={{ opacity: 0.5, textAlign: "center", padding: "2rem 0" }}>{t("decisions.empty_state")}</p>
      )}
      {!loading && entries.length > 0 && (
        <div className="decision-table-wrap">
        <table className="decision-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {(["date", "ticker", "asset_type", "type", "price", "reason_preview", "status"] as const).map((col) => (
                <th key={col} style={{ textAlign: "left", padding: "0.5rem 0.75rem", opacity: 0.6, fontWeight: 600 }}>
                  {col === "asset_type" ? t("decisions.form.asset_type") : t(`decisions.col.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <td style={{ padding: "0.55rem 0.75rem", whiteSpace: "nowrap" }}>{formatDate(entry.decided_at)}</td>
                <td style={{ padding: "0.55rem 0.75rem", fontWeight: 700 }}>{entry.ticker}</td>
                <td style={{ padding: "0.55rem 0.75rem" }}>
                  <span style={{ padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.78rem", background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                    {t(`decisions.asset_type.${(entry.asset_type ?? "STOCK").toLowerCase()}`)}
                  </span>
                </td>
                <td style={{ padding: "0.55rem 0.75rem" }}>
                  <span style={{
                    padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem",
                    background: entry.decision_type === "BUY" ? "rgba(80,220,120,0.15)" : entry.decision_type === "SELL" ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.08)",
                    color: entry.decision_type === "BUY" ? "#50dc78" : entry.decision_type === "SELL" ? "#ff5050" : "inherit",
                  }}>
                    {t(`decisions.type.${entry.decision_type.toLowerCase()}`)}
                  </span>
                </td>
                <td style={{ padding: "0.55rem 0.75rem" }}>{formatVND(entry.entry_price, entry.asset_type)}</td>
                <td style={{ padding: "0.55rem 0.75rem", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.reason.slice(0, 120)}{entry.reason.length > 120 ? "…" : ""}
                </td>
                <td style={{ padding: "0.55rem 0.75rem" }}>
                  <span style={{
                    padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.78rem",
                    background: entry.latest_verdict === "CORRECT"
                      ? "rgba(80,220,120,0.15)"
                      : entry.latest_verdict === "WRONG"
                        ? "rgba(255,80,80,0.15)"
                        : entry.latest_verdict === "UNCLEAR"
                          ? "rgba(245,200,66,0.15)"
                          : "rgba(255,255,255,0.06)",
                    color: entry.latest_verdict === "CORRECT"
                      ? "#50dc78"
                      : entry.latest_verdict === "WRONG"
                        ? "#ff5050"
                        : entry.latest_verdict === "UNCLEAR"
                          ? "#f5c842"
                          : "rgba(255,255,255,0.4)",
                  }}>
                    {entry.latest_verdict
                      ? t(`decisions.verdict.${entry.latest_verdict.toLowerCase()}`)
                      : t("decisions.badge.not_reviewed")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
