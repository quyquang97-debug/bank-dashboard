import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchDecision, deleteDecision, updateDecisionNote, createReview, fetchCurrentPrice } from "../../api/client";
import type { DecisionEntry, DecisionReview } from "../../api/client";

interface Props {
  id: number;
  onEdit: (entry: DecisionEntry) => void;
  onBack: () => void;
  onDeleted: () => void;
}

function formatVND(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN") + " đ";
}

function formatPct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function RiskPlanTable({ plan }: { plan: Record<string, unknown> }) {
  const rows: Array<[string, React.ReactNode]> = [];
  if (plan.stop_loss) {
    const sl = plan.stop_loss as { mode: string; value: number };
    rows.push(["Stop-loss", sl.mode === "pct" ? `${sl.value}%` : formatVND(sl.value)]);
  }
  const tps = plan.take_profits as Array<{ mode: string; value: number; exit_pct: number }> | undefined;
  if (tps?.length) {
    tps.forEach((tp, i) => {
      const priceStr = tp.mode === "pct" ? `${tp.value}%` : formatVND(tp.value);
      const total = tp.mode === "abs" && tp.exit_pct > 0 ? formatVND(tp.value * tp.exit_pct) : null;
      rows.push([
        `Take-profit ${i + 1}`,
        <span>
          {priceStr}
          {tp.mode === "abs" && <> · bán <strong>{tp.exit_pct.toLocaleString()}</strong> CP</>}
          {tp.mode === "pct" && <> · chốt {tp.exit_pct}%</>}
          {total && <> · <span style={{ color: "#50dc78" }}>{total}</span></>}
        </span>,
      ]);
    });
  }
  const dcas = plan.dca_levels as Array<{ mode: string; value: number; add_volume: number }> | undefined;
  if (dcas?.length) {
    dcas.forEach((d, i) => {
      const priceStr = d.mode === "pct" ? `${d.value}%` : formatVND(d.value);
      const total = d.mode === "abs" && d.add_volume > 0 ? formatVND(d.value * d.add_volume) : null;
      rows.push([
        `DCA ${i + 1}`,
        <span>
          {priceStr}
          {d.mode === "abs" && <> · mua thêm <strong>{d.add_volume.toLocaleString()}</strong> CP</>}
          {d.mode === "pct" && <> · mua thêm {d.add_volume}%</>}
          {total && <> · <span style={{ color: "#f5c842" }}>{total}</span></>}
        </span>,
      ]);
    });
  }
  if (plan.max_portfolio_pct != null) {
    rows.push(["Tỉ trọng tối đa", `${plan.max_portfolio_pct}%`]);
  }
  if (rows.length === 0) return <span style={{ opacity: 0.4 }}>—</span>;
  return (
    <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
      <tbody>
        {rows.map(([label, value], idx) => (
          <tr key={idx}>
            <td style={{ padding: "0.2rem 1rem 0.2rem 0", opacity: 0.6, whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
            <td style={{ padding: "0.2rem 0" }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReviewCard({ review }: { review: DecisionReview }) {
  const { t } = useTranslation();
  const verdictColor = review.verdict === "CORRECT" ? "#50dc78" : review.verdict === "WRONG" ? "#ff5050" : "#f5c842";
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <span style={{ fontWeight: 700, color: verdictColor, fontSize: "1rem" }}>
          {t(`decisions.verdict.${review.verdict.toLowerCase()}`)}
        </span>
        <span style={{ opacity: 0.4, fontSize: "0.8rem" }}>{formatDate(review.reviewed_at)}</span>
      </div>
      <p style={{ margin: "0 0 0.75rem", opacity: 0.85 }}>{review.verdict_reason}</p>
      {review.strengths?.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", opacity: 0.7, fontSize: "0.85rem" }}>{t("decisions.review.strengths")}</div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>{review.strengths.map((s, i) => <li key={i} style={{ fontSize: "0.87rem", marginBottom: "0.15rem" }}>{s}</li>)}</ul>
        </div>
      )}
      {review.weaknesses?.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", opacity: 0.7, fontSize: "0.85rem" }}>{t("decisions.review.weaknesses")}</div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>{review.weaknesses.map((s, i) => <li key={i} style={{ fontSize: "0.87rem", marginBottom: "0.15rem" }}>{s}</li>)}</ul>
        </div>
      )}
      {review.lessons?.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", opacity: 0.7, fontSize: "0.85rem" }}>{t("decisions.review.lessons")}</div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>{review.lessons.map((s, i) => <li key={i} style={{ fontSize: "0.87rem", marginBottom: "0.15rem" }}>{s}</li>)}</ul>
        </div>
      )}
      {review.price_snapshot && (
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.5rem", display: "flex", gap: "1.5rem", fontSize: "0.82rem", opacity: 0.65 }}>
          <span>{t("decisions.review.price_at_review")}: {formatVND(review.price_snapshot.currentPrice)}</span>
          <span style={{ color: review.price_snapshot.changePct >= 0 ? "#50dc78" : "#ff5050" }}>
            {t("decisions.review.change_pct")}: {formatPct(review.price_snapshot.changePct)}
          </span>
        </div>
      )}
    </div>
  );
}

type PricePreviewState = "idle" | "loading" | "ready" | "error";

export function DecisionDetail({ id, onEdit, onBack, onDeleted }: Props) {
  const { t, i18n } = useTranslation();
  const [entry, setEntry] = useState<DecisionEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const evalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price preview state (2-step evaluate flow)
  const [pricePreviewState, setPricePreviewState] = useState<PricePreviewState>("idle");
  const [pricePreview, setPricePreview] = useState<{ currentPrice: number; changePct: number } | null>(null);
  const [manualPrice, setManualPrice] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchDecision(id, ac.signal)
      .then((r) => {
        setEntry(r.data);
        setNote(r.data.user_note ?? "");
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  function canEvaluate(): boolean {
    if (!entry) return false;
    return Date.now() - new Date(entry.decided_at).getTime() >= 24 * 60 * 60 * 1000;
  }

  // Step 1: user clicks "Đánh giá"
  async function handleEvaluateClick() {
    if (!entry) return;
    setPriceError(null);
    setEvalError(null);
    const assetType = entry.asset_type ?? "STOCK";

    if (assetType === "STOCK") {
      setPricePreviewState("loading");
      try {
        const r = await fetchCurrentPrice(id);
        setPricePreview({ currentPrice: r.data.currentPrice, changePct: r.data.changePct });
        setPricePreviewState("ready");
      } catch (err: any) {
        setPriceError(t("decisions.evaluate_price_fail"));
        setPricePreviewState("error");
      }
    } else {
      // non-STOCK: show manual input immediately
      setManualPrice("");
      setPricePreviewState("ready");
    }
  }

  // Step 2: user confirms evaluation
  async function handleConfirmEvaluate() {
    if (!entry) return;
    setEvaluating(true);
    setEvalError(null);
    const ac = new AbortController();
    const assetType = entry.asset_type ?? "STOCK";

    evalTimeoutRef.current = setTimeout(() => {
      ac.abort();
      setEvalError(t("decisions.evaluate_timeout"));
      setEvaluating(false);
    }, 60_000);

    try {
      const lang = i18n.language?.slice(0, 2) ?? "vi";
      let currentPrice: number | undefined;
      if (assetType === "STOCK" && pricePreview) {
        currentPrice = pricePreview.currentPrice;
      } else if (assetType === "STOCK" && manualPrice !== "") {
        currentPrice = parseFloat(manualPrice);
      } else if (assetType !== "STOCK") {
        currentPrice = parseFloat(manualPrice);
      }

      const r = await createReview(id, lang, ac.signal, currentPrice);
      if (evalTimeoutRef.current) clearTimeout(evalTimeoutRef.current);

      const updated = await fetchDecision(id);
      setEntry(updated.data);
      if (!updated.data.reviews?.some((rv) => rv.id === r.data.id)) {
        setEntry((prev) => prev ? { ...prev, reviews: [r.data, ...(prev.reviews ?? [])] } : prev);
      }
      // Reset price preview state after success
      setPricePreviewState("idle");
      setPricePreview(null);
      setManualPrice("");
    } catch (err: any) {
      if (evalTimeoutRef.current) clearTimeout(evalTimeoutRef.current);
      if (err.name === "AbortError") return;
      const code = err.body?.error ?? err.message;
      if (code === "price_fetch_failed") setEvalError(t("decisions.evaluate_price_fail"));
      else if (code === "ai_invalid_response") setEvalError(t("decisions.evaluate_ai_fail"));
      else setEvalError(t("decisions.evaluate_ai_fail"));
    } finally {
      setEvaluating(false);
    }
  }

  function handleCancelEvaluate() {
    setPricePreviewState("idle");
    setPricePreview(null);
    setManualPrice("");
    setPriceError(null);
    setEvalError(null);
  }

  async function handleNoteBlur() {
    if (!entry) return;
    await updateDecisionNote(id, note || null).catch(() => {});
  }

  async function handleDelete() {
    await deleteDecision(id);
    onDeleted();
  }

  if (loading) return <p style={{ opacity: 0.5 }}>{t("decisions.loading")}</p>;
  if (error || !entry) return <p style={{ color: "#ff6b6b" }}>{t("error_load")}</p>;

  const riskPlan = entry.risk_plan
    ? (typeof entry.risk_plan === "string" ? JSON.parse(entry.risk_plan) : entry.risk_plan)
    : null;

  const assetType = entry.asset_type ?? "STOCK";
  const isSavings = assetType === "SAVINGS";
  const entryPriceLabel = isSavings ? t("decisions.form.entry_price_savings") : "Giá vào";

  const row = (label: string, value: React.ReactNode) => (
    <tr>
      <td style={{ padding: "0.35rem 1.5rem 0.35rem 0", opacity: 0.55, whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "0.35rem 0", verticalAlign: "top" }}>{value}</td>
    </tr>
  );

  const isConfirmDisabled = evaluating || (assetType !== "STOCK" && (manualPrice === "" || isNaN(parseFloat(manualPrice))));
  const manualPriceValid = manualPrice !== "" && !isNaN(parseFloat(manualPrice)) && parseFloat(manualPrice) >= 0;

  return (
    <div>
      {/* Back + actions */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", color: "inherit" }}>
          ← Back
        </button>
        <button onClick={() => onEdit({ ...entry, risk_plan: riskPlan })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", color: "inherit" }}>
          {t("decisions.btn_edit")}
        </button>
        <button onClick={() => setConfirmDelete(true)} style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", color: "#ff6b6b" }}>
          {t("decisions.btn_delete")}
        </button>
      </div>

      {confirmDelete && (
        <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
          <p style={{ margin: "0 0 0.75rem" }}>{t("decisions.confirm_delete")}</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleDelete} style={{ background: "#ff5050", border: "none", borderRadius: "6px", padding: "0.4rem 1rem", cursor: "pointer", color: "#fff", fontWeight: 700 }}>
              {t("decisions.btn_delete")}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "0.4rem 1rem", cursor: "pointer", color: "inherit" }}>
              {t("decisions.btn_cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Entry details */}
      <table style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <tbody>
          {row("Mã CK", <strong style={{ fontSize: "1.1rem" }}>{entry.ticker}</strong>)}
          {row(t("decisions.form.asset_type"), <span style={{ padding: "0.1rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "rgba(255,255,255,0.08)" }}>{t(`decisions.asset_type.${assetType.toLowerCase()}`)}</span>)}
          {row("Loại", <span style={{ color: entry.decision_type === "BUY" ? "#50dc78" : entry.decision_type === "SELL" ? "#ff5050" : "inherit" }}>{t(`decisions.type.${entry.decision_type.toLowerCase()}`)}</span>)}
          {row("Ngày quyết định", formatDate(entry.decided_at))}
          {row(entryPriceLabel, formatVND(entry.entry_price))}
          {!isSavings && row(t("decisions.form.quantity"), entry.quantity != null ? entry.quantity.toLocaleString() : "—")}
          {row(t("decisions.form.buy_amount"), entry.buy_amount != null ? formatVND(entry.buy_amount) : "—")}
          {row("Tự tin", entry.confidence != null ? `${entry.confidence}/5` : "—")}
          {row("Tâm trạng", entry.mood ? t(`decisions.mood.${entry.mood.toLowerCase()}`) : "—")}
          {row("Lý do", <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{entry.reason}</div>)}
          {row("Nguồn", entry.sources || "—")}
          {riskPlan && !isSavings && row("Risk Plan", <RiskPlanTable plan={riskPlan} />)}
          {row("Ngày tạo", formatDate(entry.created_at))}
          {entry.updated_at && entry.updated_at !== entry.created_at && row("Cập nhật lần cuối", formatDate(entry.updated_at))}
        </tbody>
      </table>

      {/* User note */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", opacity: 0.8 }}>Note cá nhân</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder={t("decisions.note_placeholder")}
          maxLength={2000}
          style={{ width: "100%", minHeight: "80px", padding: "0.5rem 0.75rem", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", resize: "vertical", boxSizing: "border-box" }}
        />
      </div>

      {/* Evaluate section */}
      <div style={{ marginBottom: "1.5rem" }}>
        {pricePreviewState === "idle" && (
          <>
            <button
              onClick={handleEvaluateClick}
              disabled={!canEvaluate()}
              title={!canEvaluate() ? t("decisions.evaluate_too_soon") : undefined}
              style={{
                padding: "0.5rem 1.5rem", background: canEvaluate() ? "#f5c842" : "rgba(255,255,255,0.1)",
                color: canEvaluate() ? "#0f1b35" : "rgba(255,255,255,0.3)",
                border: "none", borderRadius: "7px", fontWeight: 700,
                cursor: canEvaluate() ? "pointer" : "not-allowed",
              }}
            >
              {t("decisions.btn_evaluate")}
            </button>
            {!canEvaluate() && <span style={{ marginLeft: "0.75rem", opacity: 0.4, fontSize: "0.85rem" }}>{t("decisions.evaluate_too_soon")}</span>}
          </>
        )}

        {pricePreviewState === "loading" && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", display: "inline-block" }}>
            <span style={{ opacity: 0.6 }}>Đang lấy giá…</span>
          </div>
        )}

        {pricePreviewState === "error" && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "8px", background: "rgba(255,80,80,0.08)" }}>
            <div style={{ color: "#ff6b6b", marginBottom: "0.75rem" }}>{priceError}</div>
            <div style={{ marginBottom: "0.6rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem", opacity: 0.7, fontSize: "0.85rem" }}>
                {t("decisions.review.manual_price_label")}
              </label>
              <input
                type="number"
                min={0}
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="VD: 25000"
                style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", width: "220px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleConfirmEvaluate}
                disabled={evaluating || manualPrice === "" || isNaN(parseFloat(manualPrice)) || parseFloat(manualPrice) < 0}
                style={{
                  padding: "0.35rem 0.9rem", background: "#f5c842", color: "#0f1b35",
                  border: "none", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem",
                  opacity: (evaluating || manualPrice === "" || isNaN(parseFloat(manualPrice))) ? 0.4 : 1,
                }}
              >
                {evaluating ? "Đang đánh giá…" : t("decisions.review.confirm_evaluate")}
              </button>
              <button onClick={handleEvaluateClick} style={{ padding: "0.35rem 0.9rem", background: "transparent", border: "1px solid rgba(255,200,0,0.4)", borderRadius: "6px", cursor: "pointer", color: "#f5c842", fontSize: "0.85rem" }}>
                Thử lại tự động
              </button>
              <button onClick={handleCancelEvaluate} style={{ padding: "0.35rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.85rem" }}>
                {t("decisions.review.btn_cancel_evaluate")}
              </button>
            </div>
          </div>
        )}

        {pricePreviewState === "ready" && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", background: "rgba(255,255,255,0.03)" }}>
            {assetType === "STOCK" && pricePreview && (
              <div style={{ marginBottom: "0.6rem", display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
                <span>{t("decisions.review.current_price_preview")}: <strong>{formatVND(pricePreview.currentPrice)}</strong></span>
                <span style={{ color: pricePreview.changePct >= 0 ? "#50dc78" : "#ff5050" }}>
                  {t("decisions.review.change_pct_preview")}: {formatPct(pricePreview.changePct)}
                </span>
              </div>
            )}
            {assetType !== "STOCK" && (
              <div style={{ marginBottom: "0.6rem" }}>
                <label style={{ display: "block", marginBottom: "0.3rem", opacity: 0.7, fontSize: "0.85rem" }}>
                  {t("decisions.review.manual_price_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", width: "220px" }}
                  autoFocus
                />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleConfirmEvaluate}
                disabled={isConfirmDisabled || (assetType !== "STOCK" && !manualPriceValid)}
                style={{
                  padding: "0.4rem 1rem", background: "#f5c842", color: "#0f1b35",
                  border: "none", borderRadius: "6px", fontWeight: 700,
                  cursor: (isConfirmDisabled || (assetType !== "STOCK" && !manualPriceValid)) ? "not-allowed" : "pointer",
                  opacity: (isConfirmDisabled || (assetType !== "STOCK" && !manualPriceValid)) ? 0.4 : 1,
                  fontSize: "0.88rem",
                }}
              >
                {evaluating ? "Đang đánh giá…" : t("decisions.review.confirm_evaluate")}
              </button>
              <button onClick={handleCancelEvaluate} style={{ padding: "0.4rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.88rem" }}>
                {t("decisions.review.btn_cancel_evaluate")}
              </button>
            </div>
          </div>
        )}

        {evalError && <div style={{ color: "#ff6b6b", marginTop: "0.4rem", fontSize: "0.85rem" }}>{evalError}</div>}
      </div>

      {/* Reviews */}
      {(entry.reviews?.length ?? 0) > 0 && (
        <div>
          <h3 style={{ marginBottom: "0.75rem", opacity: 0.8 }}>Đánh giá ({entry.reviews!.length})</h3>
          {entry.reviews!.map((rv) => <ReviewCard key={rv.id} review={rv} />)}
        </div>
      )}
    </div>
  );
}
