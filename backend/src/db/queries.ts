import { pool } from "./connection.js";
import { detectWindow } from "../lib/detectWindow.js";

export interface Period {
  year: number;
  quarter: number;
}

export type PeriodParamsResult =
  | { type: "ok"; year: number; quarter: number }
  | { type: "missing" }
  | { type: "invalid" };

export function parsePeriodParams(
  query: Record<string, string | string[] | undefined>
): PeriodParamsResult {
  const yearStr = typeof query.year === "string" ? query.year : undefined;
  const qStr = typeof query.quarter === "string" ? query.quarter : undefined;

  if (yearStr === undefined && qStr === undefined) return { type: "missing" };
  if (yearStr === undefined || qStr === undefined) return { type: "invalid" };

  const year = Number(yearStr);
  const quarter = Number(qStr);

  if (!Number.isInteger(year) || year < 1900 || year > 2100) return { type: "invalid" };
  if (!Number.isInteger(quarter) || quarter < 0 || quarter > 4) return { type: "invalid" };

  return { type: "ok", year, quarter };
}

export async function detectCurrentPeriod(overrideDate?: Date): Promise<Period | null> {
  const win = detectWindow(overrideDate);
  if (win) return { year: win.year, quarter: win.quarter };

  const [rows] = await pool.execute<any[]>(
    `SELECT Year, Quarter
     FROM bctc_new
     ORDER BY (Year * 10 + Quarter) DESC
     LIMIT 1`
  );
  if (!rows.length) return null;
  return { year: rows[0].Year, quarter: rows[0].Quarter };
}
