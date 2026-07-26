import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createDecision, updateDecision } from "../../api/client";
import type { DecisionEntry, DecisionEntryInput, RiskPlan } from "../../api/client";

interface Props {
  entry?: DecisionEntry;
  onSave: (entry: DecisionEntry) => void;
  onCancel: () => void;
}

interface TakeProfit { value: string; exit_qty: string; }
interface DcaLevel { value: string; add_qty: string; }

type AssetType = "STOCK" | "GOLD" | "CRYPTO" | "SAVINGS";

const ASSET_TYPES: AssetType[] = ["STOCK", "GOLD", "CRYPTO", "SAVINGS"];

const TICKER_PLACEHOLDERS: Record<AssetType, string> = {
  STOCK: "VD: VCB",
  GOLD: "VD: SJC",
  CRYPTO: "VD: BTC",
  SAVINGS: "VD: BIDV-12T",
};

function now(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function calcTotal(price: string, qty: string): string {
  const p = parseFloat(price);
  const q = parseFloat(qty);
  if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) return "";
  return (p * q).toLocaleString("vi-VN") + " đ";
}

function PriceInput({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const displayValue = value ? parseInt(value, 10).toLocaleString("vi-VN") : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    onChange(raw);
  };

  const step = (delta: number, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    const n = parseInt(value, 10) || 0;
    onChange(String(Math.max(0, n + delta)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") step(500, e);
    else if (e.key === "ArrowDown") step(-500, e);
  };

  const spinBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(255,255,255,0.08)", border: "none", color: "inherit",
    cursor: "pointer", fontSize: "0.65rem", padding: 0, flex: 1, lineHeight: 1, width: "100%",
    userSelect: "none",
  };

  return (
    <div style={{ display: "flex", position: "relative", width: "100%" }}>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ ...style, paddingRight: "28px" }}
      />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "24px",
        display: "flex", flexDirection: "column", zIndex: 1,
        borderLeft: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 6px 6px 0", overflow: "hidden",
      }}>
        <button type="button" onMouseDown={(e) => step(500, e)} style={spinBtn}>▲</button>
        <button type="button" onMouseDown={(e) => step(-500, e)} style={{ ...spinBtn, borderTop: "1px solid rgba(255,255,255,0.08)" }}>▼</button>
      </div>
    </div>
  );
}

export function DecisionForm({ entry, onSave, onCancel }: Props) {
  const { t } = useTranslation();

  const [assetType, setAssetType] = useState<AssetType>(entry?.asset_type ?? "STOCK");
  const [ticker, setTicker] = useState(entry?.ticker ?? "");
  const [decisionType, setDecisionType] = useState<string>(entry?.decision_type ?? "BUY");
  const [decidedAt, setDecidedAt] = useState(entry ? entry.decided_at.slice(0, 16) : now());
  const [entryPrice, setEntryPrice] = useState(entry?.entry_price != null ? String(entry.entry_price) : "");
  const [quantity, setQuantity] = useState(entry?.quantity != null ? String(entry.quantity) : "");
  const [buyAmount, setBuyAmount] = useState(entry?.buy_amount != null ? String(entry.buy_amount) : "");
  const [reason, setReason] = useState(entry?.reason ?? "");
  const [confidence, setConfidence] = useState(entry?.confidence != null ? String(entry.confidence) : "");
  const [mood, setMood] = useState(entry?.mood ?? "");

  // risk_plan fields
  const rp = entry?.risk_plan;
  const [hasStopLoss, setHasStopLoss] = useState(rp?.stop_loss != null);
  const [slValue, setSlValue] = useState(rp?.stop_loss != null ? String(rp.stop_loss.value) : "");
  const [slExitQty, setSlExitQty] = useState(rp?.stop_loss?.exit_qty != null ? String(rp.stop_loss.exit_qty) : "");
  const [tps, setTps] = useState<TakeProfit[]>(
    rp?.take_profits?.map((tp) => ({ value: String(tp.value), exit_qty: String(tp.exit_pct) })) ?? []
  );
  const [dcas, setDcas] = useState<DcaLevel[]>(
    rp?.dca_levels?.map((d) => ({ value: String(d.value), add_qty: String(d.add_volume) })) ?? []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isSavings = assetType === "SAVINGS";
  const isStock = assetType === "STOCK";
  const isBuy = decisionType === "BUY";
  const requiresPrice = decisionType === "BUY" || decisionType === "SELL";
  const showRiskPlan = !isSavings;
  const showQuantity = !isSavings;

  // Auto-calculate buy_amount = quantity × entry_price when either changes
  useEffect(() => {
    if (isSavings) return;
    const q = parseFloat(quantity);
    const ep = parseFloat(entryPrice);
    if (!isNaN(q) && q > 0 && !isNaN(ep) && ep > 0) {
      setBuyAmount(String(Math.round(q * ep)));
    }
  }, [quantity, entryPrice, isSavings]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!ticker.trim()) errs.ticker = "Mã chứng khoán là bắt buộc";
    if (reason.length < 20) errs.reason = t("decisions.error.reason_too_short");
    if (requiresPrice && !entryPrice) errs.entry_price = "Giá vào lệnh là bắt buộc";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    const hasRiskPlanInput =
      (hasStopLoss && Boolean(slValue)) ||
      tps.some((tp) => Boolean(tp.value || tp.exit_qty)) ||
      dcas.some((d) => Boolean(d.value || d.add_qty));

    const riskPlan: RiskPlan | null = showRiskPlan && (isBuy || rp != null || hasRiskPlanInput) ? {
      ...rp,
      stop_loss: hasStopLoss && slValue ? {
        mode: "abs",
        value: parseFloat(slValue),
        ...(slExitQty ? { exit_qty: isStock ? parseInt(slExitQty, 10) : parseFloat(slExitQty) } : {}),
      } : undefined,
      take_profits: tps.map((tp) => ({ mode: "abs", value: parseFloat(tp.value), exit_pct: parseFloat(tp.exit_qty) })),
      dca_levels: dcas.map((d) => ({ mode: "abs", value: parseFloat(d.value), add_volume: parseFloat(d.add_qty) })),
    } : null;

    const body: DecisionEntryInput = {
      ticker: ticker.toUpperCase(),
      asset_type: assetType,
      decision_type: decisionType as DecisionEntry["decision_type"],
      decided_at: decidedAt.replace("T", " ") + ":00",
      entry_price: entryPrice ? parseFloat(entryPrice) : null,
      volume: null,
      quantity: showQuantity && quantity
        ? (isStock ? parseInt(quantity, 10) : parseFloat(quantity))
        : null,
      buy_amount: buyAmount ? parseInt(buyAmount, 10) : null,
      risk_plan: riskPlan,
      reason,
      confidence: confidence ? parseInt(confidence, 10) : null,
      mood: (mood as DecisionEntry["mood"]) || null,
      sources: null,
      user_note: entry?.user_note ?? null,
    };

    try {
      let saved: DecisionEntry;
      if (entry) {
        const r = await updateDecision(entry.id, body);
        saved = r.data;
      } else {
        const r = await createDecision(body);
        saved = r.data;
      }
      onSave(saved);
    } catch (err: any) {
      const code = err.body?.error ?? err.message ?? "unknown";
      if (err.body?.fields) {
        const fieldErrs: Record<string, string> = {};
        for (const f of err.body.fields as Array<{ field: string; code: string }>) {
          fieldErrs[f.field] = f.code;
        }
        setErrors(fieldErrs);
      } else {
        setServerError(code);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.4rem 0.7rem", borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)",
    color: "inherit", width: "100%", boxSizing: "border-box",
  };
  const readonlyInputStyle: React.CSSProperties = {
    ...inputStyle, opacity: 0.55, cursor: "default",
  };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "0.25rem", opacity: 0.7, fontSize: "0.85rem" };
  const fieldStyle: React.CSSProperties = { marginBottom: "1rem" };
  const errStyle: React.CSSProperties = { color: "#ff6b6b", fontSize: "0.8rem", marginTop: "0.2rem" };

  const entryPriceLabel = isSavings
    ? t("decisions.form.entry_price_savings")
    : `${t("decisions.form.entry_price")}${requiresPrice ? " *" : ""}`;

  return (
    <form onSubmit={handleSubmit} className="decision-form">
      <div className="decision-form-grid">
        {/* Asset type */}
        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.asset_type")} *</label>
          <select style={inputStyle} value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}>
            {ASSET_TYPES.map((v) => (
              <option key={v} value={v}>{t(`decisions.asset_type.${v.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.ticker")} *</label>
          <input
            style={inputStyle}
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            maxLength={10}
            placeholder={TICKER_PLACEHOLDERS[assetType]}
          />
          {errors.ticker && <div style={errStyle}>{errors.ticker}</div>}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.decision_type")} *</label>
          <select style={inputStyle} value={decisionType} onChange={(e) => setDecisionType(e.target.value)}>
            {["BUY", "SELL", "HOLD", "WATCH"].map((v) => (
              <option key={v} value={v}>{t(`decisions.type.${v.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.decided_at")} *</label>
          <input type="datetime-local" style={inputStyle} value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{entryPriceLabel}</label>
          {isStock ? (
            <PriceInput value={entryPrice} onChange={setEntryPrice} placeholder="VD: 25.000" style={inputStyle} />
          ) : (
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              style={inputStyle}
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder={isSavings ? "VD: 100000000" : "VD: 1234.56"}
            />
          )}
          {errors.entry_price && <div style={errStyle}>{errors.entry_price}</div>}
        </div>

        {showQuantity && (
          <div style={fieldStyle}>
            <label style={labelStyle}>{t("decisions.form.quantity")}</label>
            <input
              type="number"
              inputMode={isStock ? "numeric" : "decimal"}
              min={0}
              step={isStock ? 1 : "any"}
              style={inputStyle}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {errors.quantity && <div style={errStyle}>{errors.quantity}</div>}
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.buy_amount")}</label>
          <PriceInput value={buyAmount} onChange={setBuyAmount} style={inputStyle} />
          {errors.buy_amount && <div style={errStyle}>{errors.buy_amount}</div>}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.confidence")} (1–5)</label>
          <input type="number" min={1} max={5} style={inputStyle} value={confidence} onChange={(e) => setConfidence(e.target.value)} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>{t("decisions.form.mood")}</label>
          <select style={inputStyle} value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">—</option>
            {["CALM", "EXCITED", "FEARFUL", "FOMO", "NEUTRAL"].map((v) => (
              <option key={v} value={v}>{t(`decisions.mood.${v.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Risk plan — hidden for SAVINGS */}
      {showRiskPlan && (
        <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.75rem", opacity: 0.8 }}>Risk Plan</div>

          {/* Take profits */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={labelStyle}>{t("decisions.form.take_profit")}</label>
              <button type="button" onClick={() => setTps([...tps, { value: "", exit_qty: "" }])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" }}>
                + Add TP
              </button>
            </div>
            {tps.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Giá chốt (VNĐ)</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Số CP bán</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Tổng tiền</span>
                <span />
              </div>
            )}
            {tps.map((tp, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
                <PriceInput value={tp.value} onChange={(v) => setTps(tps.map((x, j) => j === i ? { ...x, value: v } : x))}
                  placeholder="VD: 30.000" style={inputStyle} />
                <input type="number" inputMode={isStock ? "numeric" : "decimal"} min={0} step={isStock ? 1 : "any"} style={inputStyle} placeholder="VD: 500"
                  value={tp.exit_qty}
                  onChange={(e) => setTps(tps.map((x, j) => j === i ? { ...x, exit_qty: e.target.value } : x))} />
                <input readOnly style={readonlyInputStyle} value={calcTotal(tp.value, tp.exit_qty)} placeholder="—" />
                <button type="button" onClick={() => setTps(tps.filter((_, j) => j !== i))}
                  style={{ color: "#ff6b6b", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: 0 }}>✕</button>
              </div>
            ))}
          </div>

          {/* DCA levels */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={labelStyle}>{t("decisions.form.dca")}</label>
              <button type="button" onClick={() => setDcas([...dcas, { value: "", add_qty: "" }])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" }}>
                + Add DCA
              </button>
            </div>
            {dcas.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Giá DCA (VNĐ)</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Số CP mua thêm</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Tổng tiền</span>
                <span />
              </div>
            )}
            {dcas.map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
                <PriceInput value={d.value} onChange={(v) => setDcas(dcas.map((x, j) => j === i ? { ...x, value: v } : x))}
                  placeholder="VD: 22.000" style={inputStyle} />
                <input type="number" inputMode={isStock ? "numeric" : "decimal"} min={0} step={isStock ? 1 : "any"} style={inputStyle} placeholder="VD: 500"
                  value={d.add_qty}
                  onChange={(e) => setDcas(dcas.map((x, j) => j === i ? { ...x, add_qty: e.target.value } : x))} />
                <input readOnly style={readonlyInputStyle} value={calcTotal(d.value, d.add_qty)} placeholder="—" />
                <button type="button" onClick={() => setDcas(dcas.filter((_, j) => j !== i))}
                  style={{ color: "#ff6b6b", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: 0 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Stop loss — optional, add via button */}
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={labelStyle}>{t("decisions.form.stop_loss")} (VNĐ)</label>
              {!hasStopLoss && (
                <button type="button" onClick={() => setHasStopLoss(true)}
                  style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" }}>
                  + Add SL
                </button>
              )}
            </div>
            {hasStopLoss && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Giá cắt lỗ (VNĐ)</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Số CP bán</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Tổng tiền</span>
                  <span />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 24px", gap: "0.4rem", alignItems: "center" }}>
                  <PriceInput value={slValue} onChange={setSlValue} placeholder="VD: 23.000" style={inputStyle} />
                  <input type="number" inputMode={isStock ? "numeric" : "decimal"} min={0} step={isStock ? 1 : "any"} style={inputStyle} placeholder="VD: 500"
                    value={slExitQty}
                    onChange={(e) => setSlExitQty(e.target.value)} />
                  <input readOnly style={readonlyInputStyle} value={calcTotal(slValue, slExitQty)} placeholder="—" />
                  <button type="button" onClick={() => { setHasStopLoss(false); setSlValue(""); setSlExitQty(""); }}
                    style={{ color: "#ff6b6b", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: 0 }}>✕</button>
                </div>
              </>
            )}
            {errors["risk_plan.stop_loss"] && <div style={errStyle}>{errors["risk_plan.stop_loss"]}</div>}
            {errors.stop_loss && <div style={errStyle}>{errors.stop_loss}</div>}
          </div>
        </div>
      )}

      {(errors["risk_plan.take_profits"] || errors["risk_plan.dca_levels"] || errors["risk_plan.stop_loss"]) && (
        <div style={{ ...errStyle, marginBottom: "1rem", padding: "0.5rem 0.75rem", background: "rgba(255,80,80,0.1)", borderRadius: "6px" }}>
          Risk plan lỗi: {errors["risk_plan.take_profits"] || errors["risk_plan.dca_levels"] || errors["risk_plan.stop_loss"]}
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>{t("decisions.form.reason")} * (≥20 ký tự)</label>
        <textarea
          style={{ ...inputStyle, height: "120px", resize: "vertical" }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={5000}
        />
        <div style={{ fontSize: "0.78rem", opacity: 0.4, textAlign: "right" }}>{reason.length}/5000</div>
        {errors.reason && <div style={errStyle}>{errors.reason}</div>}
      </div>

      {serverError && <div style={{ ...errStyle, marginBottom: "1rem", padding: "0.5rem 0.75rem", background: "rgba(255,80,80,0.1)", borderRadius: "6px" }}>{serverError}</div>}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" disabled={submitting} style={{
          padding: "0.5rem 1.5rem", background: "#f5c842", color: "#0f1b35",
          border: "none", borderRadius: "7px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? t("decisions.loading") : t("decisions.btn_save")}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: "0.5rem 1.2rem", background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: "7px", cursor: "pointer", color: "inherit",
        }}>
          {t("decisions.btn_cancel")}
        </button>
      </div>
    </form>
  );
}
