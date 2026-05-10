import { Router, Request, Response } from "express";
import { calMos } from "../paybacktime/CalMos.js";
import { GetTradeInfo } from "../paybacktime/GetTradeInfo.js";
import { saveMos } from "../lib/saveMos.js";
import { pool } from "../db/connection.js";

export const valuationRouter = Router();

const StockCodeList = [
  "ACB", "BID", "CTG", "HDB", "LPB", "MBB", "MSB", "SHB",
  "STB", "TCB", "TPB", "VCB", "VIB", "VPB", "SSB", "BVB", "NAB",
];

valuationRouter.post("/run", async (_req: Request, res: Response) => {
  try {
    const results = await Promise.allSettled(
      StockCodeList.map(async (code) => {
        const mos = await calMos(code);
        const currentPrice = await GetTradeInfo(code);
        await saveMos(code, mos, currentPrice);
      })
    );
    const skipped = StockCodeList.filter((_, i) => results[i].status === "rejected");
    if (skipped.length > 0) {
      console.error("Valuation skipped banks:", skipped);
    }
    return res.json({ success: true, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

valuationRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT StockCode, MOS, current_price, ti_suat_sinh_loi, updated_at FROM paybacktime ORDER BY ti_suat_sinh_loi DESC"
    );
    return res.json({ data: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});
