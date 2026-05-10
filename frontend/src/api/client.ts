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
