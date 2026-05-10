import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchPeriods, fetchScreening } from "../api/client";
import type { Period, ScreeningRow } from "../api/client";
import { PeriodFilter } from "./PeriodFilter";

type UIState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "result"; rows: ScreeningRow[] };

const SIGNAL_CONFIG = {
  MUA: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.13)",
    border: "rgba(74,222,128,0.28)",
    rowTint: "rgba(74,222,128,0.04)",
    labelKey: "signal_buy" as const,
    cardKey: "card_buy" as const,
    emoji: "▲",
    cardBorder: "rgba(74,222,128,0.2)",
  },
  GIỮ: {
    color: "#f5c842",
    bg: "rgba(245,200,66,0.13)",
    border: "rgba(245,200,66,0.28)",
    rowTint: "rgba(245,200,66,0.04)",
    labelKey: "signal_hold" as const,
    cardKey: "card_hold" as const,
    emoji: "●",
    cardBorder: "rgba(245,200,66,0.2)",
  },
  TRÁNH: {
    color: "#f87171",
    bg: "rgba(248,113,113,0.13)",
    border: "rgba(248,113,113,0.28)",
    rowTint: "rgba(248,113,113,0.04)",
    labelKey: "signal_avoid" as const,
    cardKey: "card_avoid" as const,
    emoji: "▼",
    cardBorder: "rgba(248,113,113,0.2)",
  },
} as const;

export function ScreeningTab() {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [ui, setUi] = useState<UIState>({ kind: "loading" });

  useEffect(() => {
    fetchPeriods()
      .then((res: any) => {
        const data: Period[] = res.data ?? [];
        setPeriods(data);
        setSelectedPeriod(data[0] ?? null);
      })
      .catch(() => setUi({ kind: "error" }));
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;
    const controller = new AbortController();

    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setUi({ kind: "loading" });
        return fetchScreening(selectedPeriod.year, selectedPeriod.quarter, controller.signal);
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        setUi(res.data.length === 0 ? { kind: "empty" } : { kind: "result", rows: res.data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setUi({ kind: "error" });
      });

    return () => controller.abort();
  }, [selectedPeriod]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "20px" }}>
        <PeriodFilter periods={periods} selected={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {ui.kind === "loading" && <p>{t("loading_calculating")}</p>}
      {ui.kind === "error" && <p style={{ color: "#f87171" }}>{t("error_load_retry")}</p>}
      {ui.kind === "empty" && <p>{t("no_data_period")}</p>}
      {ui.kind === "result" && <ScreeningContent rows={ui.rows} />}

      <p style={{ marginTop: "20px", fontSize: "0.75rem", color: "rgba(210,225,255,0.3)", lineHeight: 1.6 }}>
        {t("screening_formula")}
      </p>
    </div>
  );
}

function ScreeningContent({ rows }: { rows: ScreeningRow[] }) {
  const { t } = useTranslation();
  const counts = { MUA: 0, GIỮ: 0, TRÁNH: 0 };
  rows.forEach((r) => { if (r.signal in counts) counts[r.signal as keyof typeof counts]++; });

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        {(["MUA", "GIỮ", "TRÁNH"] as const).map((sig) => {
          const cfg = SIGNAL_CONFIG[sig];
          return (
            <div
              key={sig}
              style={{
                flex: 1,
                background: cfg.bg,
                border: `1px solid ${cfg.cardBorder}`,
                borderRadius: "10px",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{cfg.emoji}</span>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
                  {counts[sig]}
                </div>
                <div style={{ fontSize: "0.68rem", color: cfg.color, opacity: 0.75, letterSpacing: "0.12em", fontWeight: 600, marginTop: "2px" }}>
                  {t(cfg.cardKey)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th style={{ width: "40px" }}>#</th>
            <th>{t("col_stock_code")}</th>
            <th>{t("col_rank_score")}</th>
            <th>{t("col_val_score")}</th>
            <th>{t("col_score")}</th>
            <th>{t("col_price")}</th>
            <th>{t("col_mos")}</th>
            <th>{t("col_return")}</th>
            <th>{t("col_signal")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const cfg = SIGNAL_CONFIG[row.signal as keyof typeof SIGNAL_CONFIG];
            return (
              <tr key={row.stockCode} style={{ backgroundColor: cfg?.rowTint }}>
                <td style={{ color: "rgba(210,225,255,0.3)", fontSize: "0.78rem" }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: "var(--text-h)", letterSpacing: "0.04em" }}>{row.stockCode}</td>
                <td>{row.s_rank.toFixed(1)}</td>
                <td>{row.s_val.toFixed(1)}</td>
                <td style={{ fontWeight: 600 }}>{row.score.toFixed(1)}</td>
                <td>{row.current_price > 0 ? row.current_price.toFixed(2) : "—"}</td>
                <td>{row.MOS > 0 ? row.MOS.toFixed(2) : "—"}</td>
                <td style={{ color: row.ti_suat_sinh_loi > 0 ? "#4ade80" : row.ti_suat_sinh_loi < 0 ? "#f87171" : undefined }}>
                  {row.ti_suat_sinh_loi !== 0 ? `${(row.ti_suat_sinh_loi * 100).toFixed(1)}%` : "—"}
                </td>
                <td>
                  {cfg && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        background: cfg.bg,
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      <span style={{ fontSize: "0.6rem" }}>{cfg.emoji}</span>
                      {t(cfg.labelKey)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
