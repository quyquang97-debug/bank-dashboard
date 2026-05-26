import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchDecisionSummary, triggerPatternAnalysis } from "../../api/client";
import type { DecisionSummaryResponse, PatternResult } from "../../api/client";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function DecisionSummary() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<DecisionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    fetchDecisionSummary({ from: filterFrom || undefined, to: filterTo || undefined })
      .then((r) => setSummary(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterFrom, filterTo]);

  async function handleComputePatterns() {
    setComputing(true);
    setPatternError(null);
    const lang = i18n.language?.slice(0, 2) ?? "vi";
    try {
      await triggerPatternAnalysis(lang);
      load();
    } catch (err: any) {
      if (err.message === "insufficient_data") setPatternError(t("decisions.insufficient_data"));
      else setPatternError(err.message);
    } finally {
      setComputing(false);
    }
  }

  const totalPct = summary ? summary.total : 0;

  function pctBar(count: number, color: string, label: string) {
    const pct = totalPct > 0 ? (count / totalPct) * 100 : 0;
    return (
      <div style={{ marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "0.88rem" }}>
          <span>{label}</span>
          <span>{count} ({pct.toFixed(0)}%)</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.4s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px" }}>
      <h3 style={{ marginBottom: "1rem", opacity: 0.8 }}>{t("decisions.summary.title")}</h3>

      {/* Date filter */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center" }}>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" }} />
        <span style={{ opacity: 0.5 }}>→</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" }} />
      </div>

      {loading && <p style={{ opacity: 0.5 }}>{t("decisions.loading")}</p>}
      {error && <p style={{ color: "#ff6b6b" }}>{t("error_load")}</p>}

      {!loading && summary && (
        <>
          {/* Verdict bars */}
          <div style={{ marginBottom: "1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ marginBottom: "0.75rem", opacity: 0.5, fontSize: "0.82rem" }}>
              {t("decisions.summary.total")}: {summary.total}
            </div>
            {pctBar(summary.correct, "#50dc78", t("decisions.summary.correct"))}
            {pctBar(summary.wrong, "#ff5050", t("decisions.summary.wrong"))}
            {pctBar(summary.unclear, "#f5c842", t("decisions.summary.unclear"))}
          </div>

          {/* Patterns */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600, opacity: 0.8 }}>Patterns</span>
              <button
                onClick={handleComputePatterns}
                disabled={computing || summary.total < 5}
                style={{
                  padding: "0.35rem 0.9rem", background: "#f5c842", color: "#0f1b35",
                  border: "none", borderRadius: "6px", fontWeight: 600, cursor: computing || summary.total < 5 ? "not-allowed" : "pointer",
                  opacity: computing || summary.total < 5 ? 0.5 : 1, fontSize: "0.85rem",
                }}
              >
                {computing ? "…" : t("decisions.btn_patterns")}
              </button>
            </div>

            {patternError && <p style={{ color: "#ff6b6b", fontSize: "0.85rem" }}>{patternError}</p>}

            {summary.total < 5 ? (
              <p style={{ opacity: 0.45, fontSize: "0.85rem" }}>{t("decisions.insufficient_data")}</p>
            ) : !summary.patternCache ? (
              <p style={{ opacity: 0.45, fontSize: "0.85rem" }}>{t("decisions.no_pattern")}</p>
            ) : (
              <PatternDisplay
                result={summary.patternCache.result as PatternResult}
                computedAt={summary.patternCache.computedAt}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PatternDisplay({ result, computedAt }: { result: PatternResult; computedAt: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <div style={{ opacity: 0.35, fontSize: "0.78rem", marginBottom: "0.75rem" }}>
        {t("decisions.pattern_computed_at", { datetime: formatDateTime(computedAt) })}
      </div>

      {result.mistakes?.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 600, color: "#ff5050", marginBottom: "0.4rem", fontSize: "0.88rem" }}>
            {t("decisions.summary.mistake_patterns")}
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {result.mistakes.map((p, i) => (
              <li key={i} style={{ marginBottom: "0.3rem", fontSize: "0.87rem" }}>
                {p.description} <span style={{ opacity: 0.45 }}>({p.count}×)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.successes?.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, color: "#50dc78", marginBottom: "0.4rem", fontSize: "0.88rem" }}>
            {t("decisions.summary.success_patterns")}
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {result.successes.map((p, i) => (
              <li key={i} style={{ marginBottom: "0.3rem", fontSize: "0.87rem" }}>
                {p.description} <span style={{ opacity: 0.45 }}>({p.count}×)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
