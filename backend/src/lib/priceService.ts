import axios from "axios";

export class PriceFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceFetchError";
  }
}

export interface DailyPrice {
  date: string;
  close: number;
}

export interface PriceSnapshot {
  currentPrice: number;
  changePct: number;
  maxPrice: number | null;
  maxDate: string | null;
  minPrice: number | null;
  minDate: string | null;
  slHit: boolean | null;
  tpHits: number[] | null;
}

const VIETSTOCK_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
  Connection: "keep-alive",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  Origin: "https://finance.vietstock.vn",
  Referer: "https://finance.vietstock.vn/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

function getAuthHeaders() {
  return {
    ...VIETSTOCK_HEADERS,
    Cookie: process.env.VIETSTOCK_COOKIE as string,
  };
}

function getToken(): string {
  return process.env.VIETSTOCK_TOKEN as string;
}

export async function getCurrentPrice(ticker: string): Promise<number> {
  const url = "https://finance.vietstock.vn/company/tradinginfo";
  const data = new URLSearchParams({
    code: ticker,
    s: "0",
    t: "",
    __RequestVerificationToken: getToken(),
  });
  try {
    const rs = await axios.post(url, data, {
      headers: getAuthHeaders(),
      timeout: 30_000,
    });
    return rs.data.LastPrice;
  } catch (err) {
    throw new PriceFetchError(`getCurrentPrice failed for ${ticker}: ${String(err)}`);
  }
}

export async function getHistoricalPrices(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<DailyPrice[]> {
  // Vietstock historicalquote expects dd/MM/yyyy format
  const url = "https://finance.vietstock.vn/company/historicalquote";
  const data = new URLSearchParams({
    code: ticker,
    startDate,
    endDate,
    orderBy: "TradingDate",
    orderDir: "ASC",
    page: "1",
    pageSize: "500",
    __RequestVerificationToken: getToken(),
  });
  try {
    const rs = await axios.post(url, data, {
      headers: getAuthHeaders(),
      timeout: 30_000,
    });
    const rows: Array<{ TradingDate: string; ClosePrice: number }> = rs.data?.Data ?? rs.data ?? [];
    return rows.map((r) => ({
      date: r.TradingDate,
      close: r.ClosePrice,
    }));
  } catch (err) {
    throw new PriceFetchError(`getHistoricalPrices failed for ${ticker}: ${String(err)}`);
  }
}

function toVietstockDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateForVietstock(isoDate: string): string {
  return toVietstockDate(new Date(isoDate));
}

export function buildPriceSnapshot(
  entryPrice: number,
  riskPlan: {
    stop_loss?: { mode: "abs" | "pct"; value: number };
    take_profits?: Array<{ mode: "abs" | "pct"; value: number; exit_pct: number }>;
  } | null,
  history: DailyPrice[],
  currentPrice: number
): PriceSnapshot {
  const changePct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

  let maxPrice = currentPrice;
  let maxDate = new Date().toISOString();
  let minPrice = currentPrice;
  let minDate = new Date().toISOString();

  for (const d of history) {
    if (d.close > maxPrice) {
      maxPrice = d.close;
      maxDate = d.date;
    }
    if (d.close < minPrice) {
      minPrice = d.close;
      minDate = d.date;
    }
  }

  const resolvePrice = (mode: "abs" | "pct", value: number): number => {
    if (mode === "abs") return value;
    return entryPrice * (1 + value / 100);
  };

  let slHit = false;
  if (riskPlan?.stop_loss && entryPrice > 0) {
    const slPrice = resolvePrice(riskPlan.stop_loss.mode, riskPlan.stop_loss.value);
    slHit = minPrice <= slPrice;
  }

  const tpHits: number[] = [];
  if (riskPlan?.take_profits && entryPrice > 0) {
    for (let i = 0; i < riskPlan.take_profits.length; i++) {
      const tp = riskPlan.take_profits[i];
      const tpPrice = resolvePrice(tp.mode, tp.value);
      if (maxPrice >= tpPrice) tpHits.push(i);
    }
  }

  return { currentPrice, changePct, maxPrice, maxDate, minPrice, minDate, slHit, tpHits };
}

export function buildNonStockPriceSnapshot(
  entryPrice: number,
  currentPrice: number
): PriceSnapshot {
  const changePct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  return { currentPrice, changePct, maxPrice: null, maxDate: null, minPrice: null, minDate: null, slHit: null, tpHits: null };
}
