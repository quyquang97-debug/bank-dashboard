import { Router, Request, Response } from "express";
import { pool } from "../db/connection.js";

export const periodsRouter = Router();

periodsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT DISTINCT Year, Quarter
       FROM bctc_new
       ORDER BY Year DESC, Quarter DESC`
    );
    const data = rows.map((r) => ({ year: r.Year, quarter: r.Quarter }));
    return res.json({ data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
