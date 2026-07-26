import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchDecision, deleteDecision, updateDecisionNote, createReview, createManualReview, fetchCurrentPrice } from "../../api/client";
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

function formatAssetValue(
  n: number | null | undefined,
  assetType: DecisionEntry["asset_type"],
  suffix = "",
): string {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN", {
    maximumFractionDigits: assetType === "STOCK" ? 0 : 20,
  }) + suffix;
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
  const isManual = review.model_id === "manual";
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, color: verdictColor, fontSize: "1rem" }}>
            {t(`decisions.verdict.${review.verdict.toLowerCase()}`)}
          </span>
          {isManual && (
            <span style={{ fontSize: "0.72rem", padding: "0.1rem 0.45rem", borderRadius: "4px", background: "rgba(255,255,255,0.1)", opacity: 0.7, fontWeight: 500 }}>
              ✍️ Thủ công
            </span>
          )}
        </div>
        <span style={{ opacity: 0.55, fontSize: "0.8rem", textAlign: "right", lineHeight: 1.4 }}>
          <span style={{ opacity: 0.6, fontSize: "0.75rem", display: "block" }}>Đánh giá lúc</span>
          {formatDate(review.reviewed_at)}
        </span>
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
      {review.price_snapshot && review.price_snapshot.currentPrice != null && (
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.5rem", display: "flex", gap: "1.5rem", fontSize: "0.82rem", opacity: 0.65 }}>
          <span>{t("decisions.review.price_at_review")}: {formatVND(review.price_snapshot.currentPrice)}</span>
          <span style={{ color: (review.price_snapshot.changePct ?? 0) >= 0 ? "#50dc78" : "#ff5050" }}>
            {t("decisions.review.change_pct")}: {formatPct(review.price_snapshot.changePct ?? 0)}
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

  // Eval mode: choose AI or manual
  const [evalMode, setEvalMode] = useState<"ai" | "manual" | null>(null);

  // Manual review form state
  const [manualVerdict, setManualVerdict] = useState<"CORRECT" | "WRONG" | "UNCLEAR">("CORRECT");
  const [manualReason, setManualReason] = useState("");
  const [manualStrengths, setManualStrengths] = useState("");
  const [manualWeaknesses, setManualWeaknesses] = useState("");
  const [manualLessons, setManualLessons] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

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

  // Step 1: open the evaluation method selector. Price lookup only starts
  // after the user explicitly chooses AI evaluation.
  function handleEvaluateClick() {
    setPriceError(null);
    setEvalError(null);
    setEvalMode(null);
    setPricePreview(null);
    setManualPrice("");
    setPricePreviewState("ready");
  }

  async function handleChooseAi() {
    if (!entry) return;
    setEvalMode("ai");
    setPriceError(null);
    setEvalError(null);
    setPricePreview(null);
    setManualPrice("");
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
      // AI still needs a user-provided current value for non-stock assets.
      setPricePreviewState("ready");
    }
  }

  function handleChooseManual() {
    setEvalMode("manual");
    setPriceError(null);
    setEvalError(null);
    setPricePreview(null);
    setManualPrice("");
    setPricePreviewState("ready");
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
    setEvalMode(null);
    setManualReason("");
    setManualStrengths("");
    setManualWeaknesses("");
    setManualLessons("");
    setManualError(null);
  }

  async function handleManualSubmit() {
    if (!entry || !manualReason.trim() || !manualPriceValid) return;
    setManualSubmitting(true);
    setManualError(null);
    try {
      const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
      // Manual evaluation always uses the price entered by the user.
      const currentPrice = manualPrice !== "" ? parseFloat(manualPrice) : undefined;
      const r = await createManualReview(entry.id, {
        verdict: manualVerdict,
        verdict_reason: manualReason.trim(),
        strengths: splitLines(manualStrengths),
        weaknesses: splitLines(manualWeaknesses),
        lessons: splitLines(manualLessons),
        current_price: currentPrice,
      });
      const updated = await fetchDecision(id);
      setEntry(updated.data);
      if (!updated.data.reviews?.some((rv) => rv.id === r.data.id)) {
        setEntry((prev) => prev ? { ...prev, reviews: [r.data, ...(prev.reviews ?? [])] } : prev);
      }
      handleCancelEvaluate();
    } catch (err: any) {
      setManualError("Lưu thất bại: " + (err.message ?? "Lỗi không xác định"));
    } finally {
      setManualSubmitting(false);
    }
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

  const detailItem = (label: string, value: React.ReactNode, wide = false) => (
    <div className={`decision-detail-item${wide ? " decision-detail-item--wide" : ""}`}>
      <div className="decision-detail-label">{label}</div>
      <div className="decision-detail-value">{value}</div>
    </div>
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
      <div className="decision-detail-grid">
        {detailItem(t("decisions.form.asset_type"), <span className="decision-detail-badge">{t(`decisions.asset_type.${assetType.toLowerCase()}`)}</span>)}
        {detailItem("Mã CK", <strong className="decision-detail-ticker">{entry.ticker}</strong>)}
        {detailItem("Loại", <span style={{ color: entry.decision_type === "BUY" ? "#50dc78" : entry.decision_type === "SELL" ? "#ff5050" : "inherit" }}>{t(`decisions.type.${entry.decision_type.toLowerCase()}`)}</span>)}
        {detailItem("Ngày quyết định", formatDate(entry.decided_at))}
        {detailItem(entryPriceLabel, formatAssetValue(entry.entry_price, assetType, " đ"))}
        {!isSavings && detailItem(t("decisions.form.quantity"), formatAssetValue(entry.quantity, assetType))}
        {detailItem(t("decisions.form.buy_amount"), entry.buy_amount != null ? formatVND(entry.buy_amount) : "—")}
        {detailItem("Tự tin", entry.confidence != null ? `${entry.confidence}/5` : "—")}
        {detailItem("Tâm trạng", entry.mood ? t(`decisions.mood.${entry.mood.toLowerCase()}`) : "—")}
        {detailItem("Nguồn", entry.sources || "—")}
        {detailItem("Ngày tạo", formatDate(entry.created_at))}
        {entry.updated_at && entry.updated_at !== entry.created_at && detailItem("Cập nhật lần cuối", formatDate(entry.updated_at))}
        {riskPlan && !isSavings && detailItem("Risk Plan", <RiskPlanTable plan={riskPlan} />, true)}
        {detailItem("Lý do", <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{entry.reason}</div>, true)}
      </div>

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
              <button onClick={handleChooseAi} style={{ padding: "0.35rem 0.9rem", background: "transparent", border: "1px solid rgba(255,200,0,0.4)", borderRadius: "6px", cursor: "pointer", color: "#f5c842", fontSize: "0.85rem" }}>
                Thử lại tự động
              </button>
              <button
                onClick={() => {
                  setPricePreviewState("ready");
                  setPricePreview(null);
                  setManualPrice("");
                  setPriceError(null);
                  setEvalMode(null);
                }}
                style={{ padding: "0.35rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.85rem" }}
              >
                ← Chọn cách khác
              </button>
            </div>
          </div>
        )}

        {pricePreviewState === "ready" && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", background: "rgba(255,255,255,0.03)" }}>
            {/* Price info row */}
            {evalMode === "ai" && assetType === "STOCK" && pricePreview && (
              <div style={{ marginBottom: "0.75rem", display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
                <span>{t("decisions.review.current_price_preview")}: <strong>{formatVND(pricePreview.currentPrice)}</strong></span>
                <span style={{ color: pricePreview.changePct >= 0 ? "#50dc78" : "#ff5050" }}>
                  {t("decisions.review.change_pct_preview")}: {formatPct(pricePreview.changePct)}
                </span>
              </div>
            )}
            {evalMode === "ai" && assetType !== "STOCK" && (
              <div style={{ marginBottom: "0.75rem" }}>
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

            {/* Mode selector */}
            {evalMode === null && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <button
                  onClick={handleChooseAi}
                  style={{
                    padding: "0.4rem 1.1rem", background: "#f5c842", color: "#0f1b35",
                    border: "none", borderRadius: "6px", fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.88rem",
                  }}
                >
                  🤖 Đánh giá bằng AI
                </button>
                <button
                  onClick={handleChooseManual}
                  style={{
                    padding: "0.4rem 1.1rem", background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.25)", borderRadius: "6px", fontWeight: 600,
                    cursor: "pointer", color: "inherit", fontSize: "0.88rem",
                  }}
                >
                  ✍️ Đánh giá thủ công
                </button>
                <button onClick={handleCancelEvaluate} style={{ padding: "0.4rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.88rem" }}>
                  {t("decisions.review.btn_cancel_evaluate")}
                </button>
              </div>
            )}

            {/* AI confirm (when mode = ai, e.g. button already clicked above via handleConfirmEvaluate) */}
            {evalMode === "ai" && (
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
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
                  {evaluating ? "Đang đánh giá…" : "🤖 " + t("decisions.review.confirm_evaluate")}
                </button>
                <button onClick={() => setEvalMode(null)} style={{ padding: "0.4rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.88rem" }}>
                  ← Quay lại
                </button>
              </div>
            )}

            {/* Manual review form */}
            {evalMode === "manual" && (
              <div style={{ marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>
                    {t("decisions.review.manual_price_label")} <span style={{ color: "#ff6b6b" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="VD: 25000"
                    style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", width: "220px" }}
                    autoFocus
                  />
                  <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", opacity: 0.5 }}>
                    Giá này sẽ được dùng để tính mức thay đổi tại thời điểm đánh giá.
                  </div>
                </div>

                {/* Verdict */}
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>Kết quả đánh giá <span style={{ color: "#ff6b6b" }}>*</span></label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {(["CORRECT", "WRONG", "UNCLEAR"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setManualVerdict(v)}
                        style={{
                          padding: "0.3rem 0.9rem", borderRadius: "6px", fontWeight: 600, fontSize: "0.84rem",
                          border: manualVerdict === v ? "2px solid" : "1px solid rgba(255,255,255,0.2)",
                          borderColor: manualVerdict === v
                            ? (v === "CORRECT" ? "#50dc78" : v === "WRONG" ? "#ff5050" : "#f5c842")
                            : undefined,
                          background: manualVerdict === v
                            ? (v === "CORRECT" ? "rgba(80,220,120,0.12)" : v === "WRONG" ? "rgba(255,80,80,0.12)" : "rgba(245,200,66,0.12)")
                            : "transparent",
                          color: manualVerdict === v
                            ? (v === "CORRECT" ? "#50dc78" : v === "WRONG" ? "#ff5050" : "#f5c842")
                            : "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {v === "CORRECT" ? "✅ Đúng" : v === "WRONG" ? "❌ Sai" : "❓ Chưa rõ"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verdict reason */}
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>Lý do đánh giá <span style={{ color: "#ff6b6b" }}>*</span></label>
                  <textarea
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                    placeholder="Nhận xét tổng quát về quyết định này…"
                    rows={3}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", resize: "vertical", boxSizing: "border-box", fontSize: "0.87rem" }}
                  />
                </div>

                {/* Strengths */}
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>Điểm mạnh (mỗi dòng 1 ý, tuỳ chọn)</label>
                  <textarea
                    value={manualStrengths}
                    onChange={(e) => setManualStrengths(e.target.value)}
                    placeholder={"Phân tích kỹ trước khi vào lệnh\nTuân thủ stop-loss"}
                    rows={2}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(80,220,120,0.25)", background: "rgba(80,220,120,0.04)", color: "inherit", resize: "vertical", boxSizing: "border-box", fontSize: "0.87rem" }}
                  />
                </div>

                {/* Weaknesses */}
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>Điểm yếu (mỗi dòng 1 ý, tuỳ chọn)</label>
                  <textarea
                    value={manualWeaknesses}
                    onChange={(e) => setManualWeaknesses(e.target.value)}
                    placeholder={"Vào lệnh quá sớm\nKhông đặt take-profit"}
                    rows={2}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.04)", color: "inherit", resize: "vertical", boxSizing: "border-box", fontSize: "0.87rem" }}
                  />
                </div>

                {/* Lessons */}
                <div>
                  <label style={{ display: "block", fontSize: "0.83rem", opacity: 0.65, marginBottom: "0.25rem" }}>Bài học rút ra (mỗi dòng 1 ý, tuỳ chọn)</label>
                  <textarea
                    value={manualLessons}
                    onChange={(e) => setManualLessons(e.target.value)}
                    placeholder={"Kiên nhẫn chờ điểm mua tốt hơn\nLuôn đặt SL trước khi vào lệnh"}
                    rows={2}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(255,200,66,0.25)", background: "rgba(255,200,66,0.04)", color: "inherit", resize: "vertical", boxSizing: "border-box", fontSize: "0.87rem" }}
                  />
                </div>

                {manualError && <div style={{ color: "#ff6b6b", fontSize: "0.85rem" }}>{manualError}</div>}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.1rem" }}>
                  <button
                    onClick={handleManualSubmit}
                    disabled={manualSubmitting || !manualReason.trim() || !manualPriceValid}
                    style={{
                      padding: "0.4rem 1.1rem", background: "#f5c842", color: "#0f1b35",
                      border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "0.88rem",
                      cursor: (manualSubmitting || !manualReason.trim() || !manualPriceValid) ? "not-allowed" : "pointer",
                      opacity: (manualSubmitting || !manualReason.trim() || !manualPriceValid) ? 0.4 : 1,
                    }}
                  >
                    {manualSubmitting ? "Đang lưu…" : "💾 Lưu đánh giá"}
                  </button>
                  <button onClick={() => setEvalMode(null)} style={{ padding: "0.4rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.88rem" }}>
                    ← Quay lại
                  </button>
                  <button onClick={handleCancelEvaluate} style={{ padding: "0.4rem 0.9rem", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", cursor: "pointer", color: "inherit", fontSize: "0.88rem", opacity: 0.6 }}>
                    {t("decisions.review.btn_cancel_evaluate")}
                  </button>
                </div>
              </div>
            )}
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
