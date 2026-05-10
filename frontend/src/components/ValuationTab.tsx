import { useEffect, useState } from "react";
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
          {run.kind === "running" ? "Đang tính toán..." : "Thực hiện định giá lại"}
        </button>
        {run.kind === "error" && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>Lỗi tính toán, vui lòng thử lại.</span>}
        {run.kind === "done" && <span style={{ color: "#34d399", fontSize: "0.85rem" }}>Định giá hoàn tất.</span>}
      </div>

      {ui.kind === "loading" && <p>Đang tải dữ liệu...</p>}
      {ui.kind === "error" && <p>Lỗi tải dữ liệu, vui lòng thử lại.</p>}
      {ui.kind === "result" && <ValuationTable rows={ui.rows} />}
    </div>
  );
}

function rowBackground(ti: number | null): string {
  if (ti === null || ti === 0) return "";
  return ti > 0 ? "rgba(52,211,153,0.09)" : "rgba(248,113,113,0.09)";
}

function ValuationTable({ rows }: { rows: ValuationRow[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>STT</th>
          <th>Mã CK</th>
          <th>Giá Hiện Tại</th>
          <th>Giá Trị Nội Tại (MOS)</th>
          <th>Tỉ Suất Sinh Lời</th>
          <th>Cập Nhật Lúc</th>
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
