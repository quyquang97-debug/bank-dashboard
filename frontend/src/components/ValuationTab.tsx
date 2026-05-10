import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { runValuation, fetchValuation } from "../api/client";

type ValuationRow = {
  StockCode: string;
  MOS: number | null;
  current_price: number | null;
  ti_suat_sinh_loi: number | null;
  updated_at: string | null;
};

type UIState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "result"; rows: ValuationRow[] };

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error" }
  | { kind: "done" };

export function ValuationTab() {
  const { t } = useTranslation();
  const [ui, setUi] = useState<UIState>({ kind: "loading" });
  const [run, setRun] = useState<RunState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const data = await fetchValuation(controller.signal);
        if (!controller.signal.aborted) {
          setUi({ kind: "result", rows: data.data ?? [] });
        }
      } catch {
        if (!controller.signal.aborted) {
          setUi({ kind: "error" });
        }
      }
    })();

    return () => controller.abort();
  }, []);

  async function handleRevaluation() {
    setRun({ kind: "running" });
    try {
      await runValuation();
      const data = await fetchValuation();
      setUi({ kind: "result", rows: data.data ?? [] });
      setRun({ kind: "done" });
    } catch {
      setRun({ kind: "error" });
    }
  }

  return (
    <div style={{ minHeight: "200px", position: "relative" }}>
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={handleRevaluation} disabled={run.kind === "running"}>
          {run.kind === "running" ? t("btn_revalue_running") : t("btn_revalue")}
        </button>
        {run.kind === "error" && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>{t("msg_revalue_error")}</span>}
        {run.kind === "done" && <span style={{ color: "#34d399", fontSize: "0.85rem" }}>{t("msg_revalue_done")}</span>}
      </div>

      {ui.kind === "loading" && <p>{t("loading_data")}</p>}
      {ui.kind === "error" && <p>{t("error_load_retry")}</p>}
      {ui.kind === "result" && <ValuationTable rows={ui.rows} />}
    </div>
  );
}

function rowBackground(ti: number | null): string {
  if (ti === null || ti === 0) return "";
  return ti > 0 ? "rgba(52,211,153,0.09)" : "rgba(248,113,113,0.09)";
}

function ValuationTable({ rows }: { rows: ValuationRow[] }) {
  const { t } = useTranslation();
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>{t("col_no")}</th>
          <th>{t("col_stock_code")}</th>
          <th>{t("col_price")}</th>
          <th>{t("col_intrinsic")}</th>
          <th>{t("col_return_rate")}</th>
          <th>{t("col_updated")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.StockCode} style={{ backgroundColor: rowBackground(row.ti_suat_sinh_loi) }}>
            <td>{i + 1}</td>
            <td>{row.StockCode}</td>
            <td>{row.current_price !== null ? row.current_price.toFixed(2) : "—"}</td>
            <td>{row.MOS !== null ? row.MOS.toFixed(2) : "—"}</td>
            <td>
              {row.ti_suat_sinh_loi !== null
                ? `${(row.ti_suat_sinh_loi * 100).toFixed(2)}%`
                : "—"}
            </td>
            <td>{row.updated_at !== null ? new Date(row.updated_at).toLocaleString() : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
