const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export interface Period {
  year: number;
  quarter: number;
}

function periodParams(period?: Period): string {
  if (!period) return "";
  const p = new URLSearchParams({ year: String(period.year), quarter: String(period.quarter) });
  return "?" + p.toString();
}

export async function fetchBanks(period?: Period, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/banks${periodParams(period)}`, { signal });
  if (!res.ok) throw new Error(`/api/banks failed: ${res.status}`);
  return res.json();
}

export async function fetchTrend(code: string, period?: Period, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/banks/${encodeURIComponent(code)}/trend${periodParams(period)}`, { signal });
  if (!res.ok) throw new Error(`/api/banks/${code}/trend failed: ${res.status}`);
  return res.json();
}

export async function fetchRanking(period?: Period, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/ranking${periodParams(period)}`, { signal });
  if (!res.ok) throw new Error(`/api/ranking failed: ${res.status}`);
  return res.json();
}

export async function fetchRankingHistory(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/ranking/history`, { signal });
  if (!res.ok) throw new Error(`/api/ranking/history failed: ${res.status}`);
  return res.json();
}

export async function fetchPeriods(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/periods`, { signal });
  if (!res.ok) throw new Error(`/api/periods failed: ${res.status}`);
  return res.json();
}

export async function runValuation(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/valuation/run`, { method: "POST", signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(`/api/valuation/run failed: ${res.status}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return res.json();
}

export async function fetchValuation(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/valuation`, { signal });
  if (!res.ok) throw new Error(`/api/valuation failed: ${res.status}`);
  return res.json();
}

export interface ScreeningRow {
  stockCode: string;
  s_rank: number;
  s_val: number;
  score: number;
  signal: "MUA" | "GIỮ" | "TRÁNH";
  totalDiem: number;
  ti_suat_sinh_loi: number;
  current_price: number;
  MOS: number;
}

export interface ScreeningResponse {
  period: { year: number; quarter: number };
  data: ScreeningRow[];
  computed_at: string;
}

export async function fetchScreening(
  year: number,
  quarter: number,
  signal?: AbortSignal
): Promise<ScreeningResponse> {
  const res = await fetch(`${BASE}/api/screening?year=${year}&quarter=${quarter}`, { signal });
  if (!res.ok) throw new Error(`/api/screening failed: ${res.status}`);
  return res.json();
}

// ── Decisions ──────────────────────────────────────────────────────────────────

export interface RiskPlan {
  stop_loss?: { mode: "abs" | "pct"; value: number; exit_qty?: number };
  take_profits?: Array<{ mode: "abs" | "pct"; value: number; exit_pct: number }>;
  dca_levels?: Array<{ mode: "abs" | "pct"; value: number; add_volume: number }>;
  trailing_stop?: { trigger_pct: number; new_sl_pct: number } | null;
  max_portfolio_pct?: number;
}

export interface DecisionEntry {
  id: number;
  ticker: string;
  asset_type: "STOCK" | "GOLD" | "CRYPTO" | "SAVINGS";
  decision_type: "BUY" | "SELL" | "HOLD" | "WATCH";
  decided_at: string;
  entry_price: number | null;
  volume: number | null;
  quantity: number | null;
  buy_amount: number | null;
  risk_plan: RiskPlan | null;
  reason: string;
  confidence: number | null;
  mood: "CALM" | "EXCITED" | "FEARFUL" | "FOMO" | "NEUTRAL" | null;
  sources: string | null;
  user_note: string | null;
  created_at: string;
  updated_at: string;
  review_count?: number;
  reviews?: DecisionReview[];
}

export interface DecisionReview {
  id: number;
  decision_id: number;
  reviewed_at: string;
  verdict: "CORRECT" | "WRONG" | "UNCLEAR";
  verdict_reason: string;
  strengths: string[];
  weaknesses: string[];
  lessons: string[];
  price_snapshot: {
    currentPrice: number;
    changePct: number;
    maxPrice: number | null;
    maxDate: string | null;
    minPrice: number | null;
    minDate: string | null;
    slHit: boolean | null;
    tpHits: number[] | null;
  } | null;
  model_id: string;
}

export interface DecisionSummaryResponse {
  correct: number;
  wrong: number;
  unclear: number;
  total: number;
  patterns: unknown[] | null;
  patternCache: { computedAt: string; result: PatternResult } | null;
}

export interface PatternResult {
  mistakes: Array<{ description: string; count: number }>;
  successes: Array<{ description: string; count: number }>;
}

export type DecisionEntryInput = Omit<DecisionEntry, "id" | "created_at" | "updated_at" | "review_count" | "reviews">;

async function decisionFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}/api/decisions${path}`, options);
  return res;
}

export async function fetchDecisions(params?: {
  ticker?: string;
  type?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}, signal?: AbortSignal) {
  const q = new URLSearchParams();
  if (params?.ticker) q.set("ticker", params.ticker);
  if (params?.type) q.set("type", params.type);
  if (params?.asset_type) q.set("asset_type", params.asset_type);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString() ? "?" + q.toString() : "";
  const res = await decisionFetch(`/${qs}`, { signal });
  if (!res.ok) throw new Error(`/api/decisions failed: ${res.status}`);
  return res.json() as Promise<{ data: DecisionEntry[] }>;
}

export async function fetchDecision(id: number, signal?: AbortSignal) {
  const res = await decisionFetch(`/${id}`, { signal });
  if (!res.ok) throw new Error(`/api/decisions/${id} failed: ${res.status}`);
  return res.json() as Promise<{ data: DecisionEntry }>;
}

export async function createDecision(body: DecisionEntryInput): Promise<{ data: DecisionEntry }> {
  const res = await decisionFetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const e = new Error(err.error ?? "create_failed");
    (e as any).status = res.status;
    (e as any).body = err;
    throw e;
  }
  return res.json();
}

export async function updateDecision(id: number, body: DecisionEntryInput): Promise<{ data: DecisionEntry }> {
  const res = await decisionFetch(`/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const e = new Error(err.error ?? "update_failed");
    (e as any).status = res.status;
    (e as any).body = err;
    throw e;
  }
  return res.json();
}

export async function deleteDecision(id: number): Promise<void> {
  const res = await decisionFetch(`/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`/api/decisions/${id} DELETE failed: ${res.status}`);
}

export async function updateDecisionNote(id: number, userNote: string | null): Promise<void> {
  const res = await decisionFetch(`/${id}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_note: userNote }),
  });
  if (!res.ok) throw new Error(`/api/decisions/${id}/note failed: ${res.status}`);
}

export async function fetchCurrentPrice(id: number, signal?: AbortSignal): Promise<{ data: { currentPrice: number; changePct: number; fetchedAt: string } }> {
  const res = await decisionFetch(`/${id}/current-price`, { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const e = new Error(err.error ?? "price_fetch_failed");
    (e as any).status = res.status;
    (e as any).body = err;
    throw e;
  }
  return res.json();
}

export async function createReview(id: number, lang: string, signal?: AbortSignal, currentPrice?: number): Promise<{ data: DecisionReview }> {
  const body = currentPrice !== undefined ? JSON.stringify({ current_price: currentPrice }) : undefined;
  const res = await decisionFetch(`/${id}/reviews?lang=${lang}`, {
    method: "POST",
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const e = new Error(err.error ?? "review_failed");
    (e as any).status = res.status;
    (e as any).body = err;
    throw e;
  }
  return res.json();
}

export interface ManualReviewInput {
  verdict: "CORRECT" | "WRONG" | "UNCLEAR";
  verdict_reason: string;
  strengths?: string[];
  weaknesses?: string[];
  lessons?: string[];
  current_price?: number;
}

export async function createManualReview(id: number, input: ManualReviewInput): Promise<{ data: DecisionReview }> {
  const body = JSON.stringify({ mode: "manual", ...input });
  const res = await decisionFetch(`/${id}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const e = new Error(err.error ?? "review_failed");
    (e as any).status = res.status;
    (e as any).body = err;
    throw e;
  }
  return res.json();
}

export async function fetchDecisionSummary(params?: { from?: string; to?: string }, signal?: AbortSignal) {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const qs = q.toString() ? "?" + q.toString() : "";
  const res = await decisionFetch(`/summary${qs}`, { signal });
  if (!res.ok) throw new Error(`/api/decisions/summary failed: ${res.status}`);
  return res.json() as Promise<{ data: DecisionSummaryResponse }>;
}

export async function triggerPatternAnalysis(lang: string): Promise<{ data: { result: PatternResult; computedAt: string } }> {
  const res = await decisionFetch(`/summary/pattern?lang=${lang}`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(err.error ?? "pattern_failed");
  }
  return res.json();
}
