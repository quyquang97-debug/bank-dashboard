import { Router, Request, Response } from "express";
import { pool } from "../db/connection.js";
import { parsePeriodParams } from "../db/queries.js";

export const rankingRouter = Router();

rankingRouter.get("/history", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<any[]>(
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
      )
      SELECT
        Year AS year,
        Quarter AS quarter,
        StockCode AS stockCode,
        COALESCE(npl_diem,0)+COALESCE(llr_diem,0)+COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
      FROM period_ranks
      ORDER BY Year ASC, Quarter ASC`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

rankingRouter.get("/", async (req: Request, res: Response) => {
  try {
    const parsed = parsePeriodParams(req.query as Record<string, string | string[] | undefined>);

    if (parsed.type === "invalid") {
      return res.status(400).json({ error: "Invalid year or quarter" });
    }

    let rows: any[];

    if (parsed.type === "missing") {
      // Backward-compat: RANK() over full bctc_new
      const [result] = await pool.execute<any[]>(
        `WITH ranked AS (
          SELECT
            StockCode,
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
          NPL AS npl, npl_diem AS nplDiem,
          LLR AS llr, llr_diem AS llrDiem,
          LDR AS ldr, ldr_diem AS ldrDiem,
          TangTruongDoanhThu AS tangTruongDoanhThu, ttt_diem AS tangTruongDoanhThuDiem,
          COALESCE(npl_diem,0)+COALESCE(llr_diem,0)
            +COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
        FROM ranked
        ORDER BY totalDiem DESC`
      );
      rows = result;
    } else {
      // Within-period RANK(): WHERE inside CTE
      const { year, quarter } = parsed;
      const [result] = await pool.execute<any[]>(
        `WITH ranked AS (
          SELECT
            StockCode,
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
          NPL AS npl, npl_diem AS nplDiem,
          LLR AS llr, llr_diem AS llrDiem,
          LDR AS ldr, ldr_diem AS ldrDiem,
          TangTruongDoanhThu AS tangTruongDoanhThu, ttt_diem AS tangTruongDoanhThuDiem,
          COALESCE(npl_diem,0)+COALESCE(llr_diem,0)
            +COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0) AS totalDiem
        FROM ranked
        ORDER BY totalDiem DESC`,
        [year, quarter]
      );
      rows = result;
    }

    return res.json({ data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
