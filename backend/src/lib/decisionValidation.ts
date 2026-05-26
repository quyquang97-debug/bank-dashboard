export interface ValidationError {
  field: string;
  code: string;
}

interface RiskPlan {
  stop_loss?: { mode: "abs" | "pct"; value: number };
  take_profits?: Array<{ mode: "abs" | "pct"; value: number; exit_pct: number }>;
  dca_levels?: Array<{ mode: "abs" | "pct"; value: number; add_volume: number }>;
  trailing_stop?: { trigger_pct: number; new_sl_pct: number } | null;
  max_portfolio_pct?: number;
}

export interface EntryInput {
  ticker?: unknown;
  asset_type?: unknown;
  decision_type?: unknown;
  decided_at?: unknown;
  entry_price?: unknown;
  volume?: unknown;
  quantity?: unknown;
  buy_amount?: unknown;
  risk_plan?: unknown;
  reason?: unknown;
  confidence?: unknown;
  mood?: unknown;
  sources?: unknown;
}

export function validateEntry(body: EntryInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.ticker || typeof body.ticker !== "string" || body.ticker.trim() === "") {
    errors.push({ field: "ticker", code: "ticker_required" });
  }

  const validTypes = ["BUY", "SELL", "HOLD", "WATCH"];
  if (!body.decision_type || !validTypes.includes(body.decision_type as string)) {
    errors.push({ field: "decision_type", code: "invalid_decision_type" });
  }

  if (!body.decided_at) {
    errors.push({ field: "decided_at", code: "decided_at_required" });
  }

  const reason = typeof body.reason === "string" ? body.reason : "";
  if (reason.length < 20) {
    errors.push({ field: "reason", code: "reason_too_short" });
  }
  if (reason.length > 5000) {
    errors.push({ field: "reason", code: "reason_too_long" });
  }

  const decisionType = body.decision_type as string;
  if (decisionType === "BUY" || decisionType === "SELL") {
    if (body.entry_price === undefined || body.entry_price === null) {
      errors.push({ field: "entry_price", code: "entry_price_required" });
    }
  }

  if (body.entry_price !== undefined && body.entry_price !== null) {
    const ep = Number(body.entry_price);
    if (isNaN(ep) || ep < 0) {
      errors.push({ field: "entry_price", code: "entry_price_invalid" });
    }
  }

  const VALID_ASSET_TYPES = ["STOCK", "GOLD", "CRYPTO", "SAVINGS"];
  if (body.asset_type !== undefined && body.asset_type !== null) {
    if (!VALID_ASSET_TYPES.includes(body.asset_type as string)) {
      errors.push({ field: "asset_type", code: "invalid_asset_type" });
    }
  }

  if (body.quantity !== undefined && body.quantity !== null) {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 0) {
      errors.push({ field: "quantity", code: "invalid_quantity" });
    }
  }

  if (body.buy_amount !== undefined && body.buy_amount !== null) {
    const ba = Number(body.buy_amount);
    if (!Number.isInteger(ba) || ba < 0) {
      errors.push({ field: "buy_amount", code: "invalid_buy_amount" });
    }
  }

  if (body.volume !== undefined && body.volume !== null) {
    const v = Number(body.volume);
    if (isNaN(v) || v < 0) {
      errors.push({ field: "volume", code: "volume_invalid" });
    }
  }

  if (body.confidence !== undefined && body.confidence !== null) {
    const c = Number(body.confidence);
    if (!Number.isInteger(c) || c < 1 || c > 5) {
      errors.push({ field: "confidence", code: "confidence_invalid" });
    }
  }

  return errors;
}
