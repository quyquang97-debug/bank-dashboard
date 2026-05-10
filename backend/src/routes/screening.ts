import { Router, Request, Response } from "express";
import { pool } from "../db/connection.js";
import {
  MUA_THRESHOLD,
  GIU_THRESHOLD,
  TI_CAP,
  S_RANK_NEUTRAL,
  WEIGHT_RANK,
  WEIGHT_VAL,
} from "../config/screeningConfig.js";

export const screeningRouter = Router();

screeningRouter.get("/", async (req: Request, res: Response) => {
  // --- Validation ---
  const yearStr = req.query.year as string | undefined;
  const quarterStr = req.query.quarter as string | undefined;

  if (yearStr === undefined) {
    return res.status(400).json({ error: "year is required" });
  }
  if (quarterStr === undefined) {
    return res.status(400).json({ error: "quarter is required" });
  }

  const yearNum = Number(yearStr);
  if (!Number.isInteger(yearNum) || yearNum <= 0) {
    return res.status(400).json({ error: "year must be a positive integer" });
  }

  const quarterNum = Number(quarterStr);
  if (!Number.isInteger(quarterNum) || quarterNum < 0 || quarterNum > 4) {
    return res.status(400).json({ error: "quarter must be one of 0,1,2,3,4" });
  }

  const year = yearNum;
  const quarter = quarterNum;

  try {
    // --- Step 1: Ranking for selected period ---
    const [rankRows] = await pool.execute<any[]>(
      `WITH period_ranks AS (
        SELECT
          Year, Quarter, StockCode,
          CASE WHEN NPL IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year, Quarter ORDER BY NPL DESC)
          END AS npl_diem,
          CASE WHEN LLR IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year, Quarter ORDER BY LLR ASC)
          END AS llr_diem,
          CASE WHEN LDR IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year, Quarter ORDER BY LDR DESC)
          END AS ldr_diem,
          CASE WHEN TangTruongDoanhThu IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year, Quarter ORDER BY TangTruongDoanhThu ASC)
          END AS ttt_diem
        FROM bctc_new
        WHERE Year = ? AND Quarter = ?
      )
      SELECT
        StockCode AS stockCode,
        COALESCE(npl_diem,0)+COALESCE(llr_diem,0)+COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
      FROM period_ranks`,
      [year, quarter]
    );

    // --- Step 2: Valuation snapshot ---
    const [valRows] = await pool.execute<any[]>(
      `SELECT StockCode, MOS, current_price, ti_suat_sinh_loi
       FROM paybacktime
       WHERE ti_suat_sinh_loi IS NOT NULL`
    );

    // --- Step 3: Build maps and intersect ---
    const rankMap = new Map<string, number>();
    for (const row of rankRows) {
      rankMap.set(row.stockCode, Number(row.totalDiem));
    }

    type ValEntry = { MOS: number; current_price: number; ti_suat_sinh_loi: number };
    const valMap = new Map<string, ValEntry>();
    for (const row of valRows) {
      valMap.set(row.StockCode, {
        MOS: row.MOS,
        current_price: row.current_price,
        ti_suat_sinh_loi: row.ti_suat_sinh_loi,
      });
    }

    const codes = [...rankMap.keys()].filter((c) => valMap.has(c));

    // Guard: empty intersection
    if (codes.length === 0) {
      return res.json({
        period: { year, quarter },
        data: [],
        computed_at: new Date().toISOString(),
      });
    }

    // --- Step 4: S_rank normalization ---
    const totalDiems = codes.map((c) => rankMap.get(c)!);
    const minD = Math.min(...totalDiems);
    const maxD = Math.max(...totalDiems);
    const sRankOf = (d: number): number =>
      maxD === minD ? S_RANK_NEUTRAL : ((d - minD) / (maxD - minD)) * 100;

    // --- Step 5: S_val ---
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const sValOf = (ti: number): number =>
      (clamp(ti, -TI_CAP, TI_CAP) + TI_CAP) / (2 * TI_CAP) * 100;

    // --- Step 6: Score ---
    const scoreOf = (sr: number, sv: number): number => WEIGHT_RANK * sr + WEIGHT_VAL * sv;

    // --- Step 7: Signal ---
    const signalOf = (sc: number): "MUA" | "GIỮ" | "TRÁNH" =>
      sc >= MUA_THRESHOLD ? "MUA" : sc >= GIU_THRESHOLD ? "GIỮ" : "TRÁNH";

    // --- Step 8: Build result, round, sort ---
    const round2 = (x: number) => Math.round(x * 100) / 100;

    const data = codes
      .map((c) => {
        const val = valMap.get(c)!;
        const sr = sRankOf(rankMap.get(c)!);
        const sv = sValOf(val.ti_suat_sinh_loi);
        const sc = scoreOf(sr, sv);
        return {
          stockCode: c,
          s_rank: round2(sr),
          s_val: round2(sv),
          score: round2(sc),
          signal: signalOf(sc),
          totalDiem: rankMap.get(c)!,
          ti_suat_sinh_loi: val.ti_suat_sinh_loi,
          current_price: val.current_price,
          MOS: val.MOS,
        };
      })
      .sort((a, b) => b.score - a.score || a.stockCode.localeCompare(b.stockCode));

    return res.json({
      period: { year, quarter },
      data,
      computed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
});
