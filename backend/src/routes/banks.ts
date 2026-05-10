import { Router, Request, Response } from "express";
import { pool } from "../db/connection.js";
import { detectCurrentPeriod, parsePeriodParams } from "../db/queries.js";

export const banksRouter = Router();

banksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const parsed = parsePeriodParams(req.query as Record<string, string | string[] | undefined>);

    if (parsed.type === "invalid") {
      return res.status(400).json({ error: "Invalid year or quarter" });
    }

    if (parsed.type === "missing") {
      // Backward-compat: detect current period, RANK() global, filter outer WHERE
      const period = await detectCurrentPeriod();
      if (!period) {
        return res.json({ data: [], meta: { period: null } });
      }

      const [rows] = await pool.execute<any[]>(
        `WITH ranked AS (
          SELECT
            StockCode, Year, Quarter,
            NPL, LLR, LDR, TangTruongDoanhThu,
            CASE WHEN NPL IS NULL THEN NULL
                 ELSE RANK() OVER (ORDER BY NPL DESC)
            END AS npl_diem,
            CASE WHEN LLR IS NULL THEN NULL
                 ELSE RANK() OVER (ORDER BY LLR ASC)
            END AS llr_diem,
            CASE WHEN LDR IS NULL THEN NULL
                 ELSE RANK() OVER (ORDER BY LDR DESC)
            END AS ldr_diem,
            CASE WHEN TangTruongDoanhThu IS NULL THEN NULL
                 ELSE RANK() OVER (ORDER BY TangTruongDoanhThu ASC)
            END AS ttt_diem
          FROM bctc_new
        )
        SELECT
          StockCode AS stockCode,
          NPL AS npl, LLR AS llr, LDR AS ldr,
          TangTruongDoanhThu AS tangTruongDoanhThu,
          COALESCE(npl_diem, 0) + COALESCE(llr_diem, 0)
            + COALESCE(ldr_diem, 0) + COALESCE(ttt_diem, 0) AS totalDiem
        FROM ranked
        WHERE Year = ? AND Quarter = ?
        ORDER BY totalDiem DESC`,
        [period.year, period.quarter]
      );

      return res.json({ data: rows, meta: { period } });
    }

    // type === 'ok': within-period RANK() — WHERE inside CTE
    const { year, quarter } = parsed;
    const [rows] = await pool.execute<any[]>(
      `WITH ranked AS (
        SELECT
          StockCode, Year, Quarter,
          NPL, LLR, LDR, TangTruongDoanhThu,
          CASE WHEN NPL IS NULL THEN NULL
               ELSE RANK() OVER (ORDER BY NPL DESC)
          END AS npl_diem,
          CASE WHEN LLR IS NULL THEN NULL
               ELSE RANK() OVER (ORDER BY LLR ASC)
          END AS llr_diem,
          CASE WHEN LDR IS NULL THEN NULL
               ELSE RANK() OVER (ORDER BY LDR DESC)
          END AS ldr_diem,
          CASE WHEN TangTruongDoanhThu IS NULL THEN NULL
               ELSE RANK() OVER (ORDER BY TangTruongDoanhThu ASC)
          END AS ttt_diem
        FROM bctc_new
        WHERE Year = ? AND Quarter = ?
      )
      SELECT
        StockCode AS stockCode,
        NPL AS npl, LLR AS llr, LDR AS ldr,
        TangTruongDoanhThu AS tangTruongDoanhThu,
        COALESCE(npl_diem, 0) + COALESCE(llr_diem, 0)
          + COALESCE(ldr_diem, 0) + COALESCE(ttt_diem, 0) AS totalDiem
      FROM ranked
      ORDER BY totalDiem DESC`,
      [year, quarter]
    );

    return res.json({ data: rows, meta: { period: { year, quarter } } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

banksRouter.get("/:code/trend", async (req: Request, res: Response) => {
  const { code } = req.params;
  if (!/^[A-Z]{2,4}$/.test(code)) {
    return res.status(400).json({ error: "Invalid stock code" });
  }

  const parsed = parsePeriodParams(req.query as Record<string, string | string[] | undefined>);
  if (parsed.type === "invalid") {
    return res.status(400).json({ error: "Invalid year or quarter" });
  }

  try {
    // Annual query: outer WHERE varies by cutoff presence
    let annualWhere = "StockCode = ?";
    let annualParams: (string | number)[] = [code];
    let quarterlyWhere = "StockCode = ?";
    let quarterlyParams: (string | number)[] = [code];

    if (parsed.type === "ok") {
      const { year, quarter } = parsed;
      // Annual cutoff: Year <= Y (same for Q=0 and Q>0)
      annualWhere = "StockCode = ? AND Year <= ?";
      annualParams = [code, year];
      if (quarter === 0) {
        // Q=0: quarterly also filter Year <= Y
        quarterlyWhere = "StockCode = ? AND Year <= ?";
        quarterlyParams = [code, year];
      } else {
        // Q>0: quarterly filter Year*10+Quarter <= Y*10+Q
        quarterlyWhere = "StockCode = ? AND (Year * 10 + Quarter) <= ?";
        quarterlyParams = [code, year * 10 + quarter];
      }
    }

    const [annualRows] = await pool.execute<any[]>(
      `WITH ranked AS (
        SELECT
          StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu,
          CASE WHEN NPL IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year ORDER BY NPL DESC)
          END AS npl_diem,
          CASE WHEN LLR IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year ORDER BY LLR ASC)
          END AS llr_diem,
          CASE WHEN LDR IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year ORDER BY LDR DESC)
          END AS ldr_diem,
          CASE WHEN TangTruongDoanhThu IS NULL THEN NULL
               ELSE RANK() OVER (PARTITION BY Year ORDER BY TangTruongDoanhThu ASC)
          END AS ttt_diem
        FROM bctc_new
        WHERE Quarter = 0
      )
      SELECT
        Year AS year, 0 AS quarter,
        CAST(Year AS CHAR) AS label,
        NPL AS npl, LLR AS llr, LDR AS ldr,
        TangTruongDoanhThu AS tangTruongDoanhThu,
        COALESCE(npl_diem,0)+COALESCE(llr_diem,0)
          +COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
      FROM ranked
      WHERE ${annualWhere}
      ORDER BY Year ASC`,
      annualParams
    );

    const [quarterlyRows] = await pool.execute<any[]>(
      `WITH ranked AS (
        SELECT
          StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu,
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
        WHERE Quarter IN (1,2,3,4)
      )
      SELECT
        Year AS year, Quarter AS quarter,
        CONCAT(Year,'Q',Quarter) AS label,
        NPL AS npl, LLR AS llr, LDR AS ldr,
        TangTruongDoanhThu AS tangTruongDoanhThu,
        COALESCE(npl_diem,0)+COALESCE(llr_diem,0)
          +COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
      FROM ranked
      WHERE ${quarterlyWhere}
      ORDER BY Year ASC, Quarter ASC`,
      quarterlyParams
    );

    if (!annualRows.length && !quarterlyRows.length) {
      return res.status(404).json({ error: "Bank not found" });
    }

    return res.json({ annual: annualRows, quarterly: quarterlyRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
