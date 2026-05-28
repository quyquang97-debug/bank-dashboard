import { Router, Request, Response } from "express";
import { pool } from "../db/connection.js";
import { validateEntry } from "../lib/decisionValidation.js";
import {
  getHistoricalPrices,
  buildPriceSnapshot,
  buildNonStockPriceSnapshot,
  formatDateForVietstock,
  PriceFetchError,
} from "../lib/priceService.js";
import {
  reviewDecision,
  analyzePatterns,
  AIInvalidResponseError,
} from "../lib/aiService.js";

export const decisionsRouter = Router();

// ── IMPORTANT: /summary routes MUST be registered BEFORE /:id (RN-1) ──────────

// GET /api/decisions/summary
decisionsRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    let dateFilter = "";
    const dateParams: string[] = [];
    if (from) { dateFilter += " AND dj.decided_at >= ?"; dateParams.push(from); }
    if (to)   { dateFilter += " AND dj.decided_at <= ?"; dateParams.push(to); }

    const [rows] = await pool.execute<any[]>(
      `SELECT dr.verdict, COUNT(*) as cnt
       FROM decision_review dr
       INNER JOIN (
         SELECT decision_id, MAX(reviewed_at) as max_ra
         FROM decision_review
         GROUP BY decision_id
       ) latest ON dr.decision_id = latest.decision_id AND dr.reviewed_at = latest.max_ra
       INNER JOIN decision_journal dj ON dr.decision_id = dj.id
       WHERE dj.deleted_at IS NULL ${dateFilter}
       GROUP BY dr.verdict`,
      dateParams
    );

    let correct = 0, wrong = 0, unclear = 0;
    for (const r of rows) {
      if (r.verdict === "CORRECT") correct = Number(r.cnt);
      else if (r.verdict === "WRONG") wrong = Number(r.cnt);
      else if (r.verdict === "UNCLEAR") unclear = Number(r.cnt);
    }
    const total = correct + wrong + unclear;

    const [cacheRows] = await pool.execute<any[]>(
      "SELECT * FROM decision_pattern_cache ORDER BY computed_at DESC LIMIT 1"
    );
    const latestCache = cacheRows.length > 0 ? cacheRows[0] : null;

    return res.json({
      data: {
        correct,
        wrong,
        unclear,
        total,
        patterns: total < 5 ? [] : (latestCache ? latestCache.result : null),
        patternCache: latestCache
          ? { computedAt: latestCache.computed_at, result: latestCache.result }
          : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// POST /api/decisions/summary/pattern
decisionsRouter.post("/summary/pattern", async (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as string) ?? "vi";

    const [reviewRows] = await pool.execute<any[]>(
      `SELECT dr.lessons, dr.weaknesses
       FROM decision_review dr
       INNER JOIN decision_journal dj ON dr.decision_id = dj.id
       WHERE dj.deleted_at IS NULL`
    );

    if (reviewRows.length < 5) {
      return res.status(400).json({ error: "insufficient_data" });
    }

    const items: string[] = [];
    for (const r of reviewRows) {
      const lessons: string[] = Array.isArray(r.lessons) ? r.lessons : JSON.parse(r.lessons ?? "[]");
      const weaknesses: string[] = Array.isArray(r.weaknesses) ? r.weaknesses : JSON.parse(r.weaknesses ?? "[]");
      items.push(...lessons, ...weaknesses);
    }

    const result = await analyzePatterns(items, lang as "vi" | "en" | "ja");

    const insertResult = await pool.execute(
      "INSERT INTO decision_pattern_cache (computed_at, result) VALUES (NOW(), ?)",
      [JSON.stringify(result)]
    );
    const insertId = (insertResult[0] as any).insertId;

    const [newRow] = await pool.execute<any[]>(
      "SELECT * FROM decision_pattern_cache WHERE id = ?",
      [insertId]
    );

    return res.json({
      data: {
        result,
        computedAt: newRow[0]?.computed_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// ── CRUD endpoints ─────────────────────────────────────────────────────────────

// GET /api/decisions
decisionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { ticker, type, from, to, limit = "50", offset = "0", asset_type } = req.query as Record<string, string>;

    const conditions: string[] = ["dj.deleted_at IS NULL"];
    const params: (string | number)[] = [];

    if (ticker) { conditions.push("ticker = ?"); params.push(ticker.toUpperCase()); }
    if (type) {
      const types = type.split(",").map((t) => t.trim().toUpperCase());
      conditions.push(`decision_type IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    }
    if (asset_type) {
      const atypes = asset_type.split(",").map((t) => t.trim().toUpperCase());
      conditions.push(`dj.asset_type IN (${atypes.map(() => "?").join(",")})`);
      params.push(...atypes);
    }
    if (from) { conditions.push("decided_at >= ?"); params.push(from); }
    if (to)   { conditions.push("decided_at <= ?"); params.push(to); }

    const where = "WHERE " + conditions.join(" AND ");
    const limitVal = parseInt(limit, 10);
    const offsetVal = parseInt(offset, 10);
    const [rows] = await pool.execute<any[]>(
      `SELECT dj.id, dj.ticker, dj.asset_type, dj.decision_type, dj.decided_at, dj.entry_price, dj.volume,
              dj.quantity, dj.buy_amount, dj.reason, dj.confidence, dj.mood, dj.created_at, dj.updated_at,
              (SELECT COUNT(*) FROM decision_review dr WHERE dr.decision_id = dj.id) as review_count
       FROM decision_journal dj ${where}
       ORDER BY dj.decided_at DESC
       LIMIT ${limitVal} OFFSET ${offsetVal}`,
      params
    );

    return res.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// GET /api/decisions/:id/current-price
decisionsRouter.get("/:id/current-price", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [entries] = await pool.execute<any[]>(
      "SELECT asset_type, ticker, entry_price FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (entries.length === 0) return res.status(404).json({ error: "not_found" });
    const entry = entries[0];
    if (entry.asset_type !== "STOCK") return res.status(400).json({ error: "not_stock" });

    const [pbRows] = await pool.execute<any[]>(
      "SELECT current_price FROM paybacktime WHERE StockCode = ?",
      [entry.ticker]
    );
    if (pbRows.length === 0 || pbRows[0].current_price == null) {
      return res.status(503).json({ error: "price_fetch_failed" });
    }
    const currentPrice: number = Number(pbRows[0].current_price);
    const changePct = entry.entry_price > 0
      ? ((currentPrice - entry.entry_price) / entry.entry_price) * 100
      : 0;
    return res.json({ data: { currentPrice, changePct, fetchedAt: new Date().toISOString() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// GET /api/decisions/:id
decisionsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [entries] = await pool.execute<any[]>(
      "SELECT * FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (entries.length === 0) return res.status(404).json({ error: "not_found" });

    const [reviews] = await pool.execute<any[]>(
      "SELECT * FROM decision_review WHERE decision_id = ? ORDER BY reviewed_at DESC",
      [id]
    );

    return res.json({ data: { ...entries[0], reviews } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// POST /api/decisions
decisionsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const errors = validateEntry(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0].code, fields: errors });
    }

    const {
      ticker, asset_type = "STOCK", decision_type, decided_at, entry_price = null,
      volume = null, quantity = null, buy_amount = null, risk_plan = null, reason,
      confidence = null, mood = null, sources = null,
    } = req.body;

    const insertResult = await pool.execute(
      `INSERT INTO decision_journal
         (ticker, asset_type, decision_type, decided_at, entry_price, volume, quantity, buy_amount, risk_plan, reason, confidence, mood, sources)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (ticker as string).toUpperCase(),
        asset_type,
        decision_type,
        decided_at,
        entry_price,
        volume,
        quantity,
        buy_amount,
        risk_plan ? JSON.stringify(risk_plan) : null,
        reason,
        confidence,
        mood,
        sources,
      ]
    );
    const insertId = (insertResult[0] as any).insertId;

    const [rows] = await pool.execute<any[]>(
      "SELECT * FROM decision_journal WHERE id = ?",
      [insertId]
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// PUT /api/decisions/:id
decisionsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute<any[]>(
      "SELECT id FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: "not_found" });

    const errors = validateEntry(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0].code, fields: errors });
    }

    const {
      ticker, asset_type = "STOCK", decision_type, decided_at, entry_price = null,
      volume = null, quantity = null, buy_amount = null, risk_plan = null, reason,
      confidence = null, mood = null, sources = null,
    } = req.body;

    await pool.execute(
      `UPDATE decision_journal
       SET ticker=?, asset_type=?, decision_type=?, decided_at=?, entry_price=?, volume=?,
           quantity=?, buy_amount=?, risk_plan=?, reason=?, confidence=?, mood=?, sources=?
       WHERE id = ?`,
      [
        (ticker as string).toUpperCase(),
        asset_type,
        decision_type,
        decided_at,
        entry_price,
        volume,
        quantity,
        buy_amount,
        risk_plan ? JSON.stringify(risk_plan) : null,
        reason,
        confidence,
        mood,
        sources,
        id,
      ]
    );

    const [rows] = await pool.execute<any[]>(
      "SELECT * FROM decision_journal WHERE id = ?",
      [id]
    );
    return res.json({ data: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// DELETE /api/decisions/:id (soft-delete)
decisionsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute<any[]>(
      "SELECT id FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: "not_found" });

    await pool.execute("UPDATE decision_journal SET deleted_at = NOW() WHERE id = ?", [id]);
    console.log(`[decisions] DELETE decision_id=${id}`);
    return res.json({ data: { id: Number(id) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// PUT /api/decisions/:id/note
decisionsRouter.put("/:id/note", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_note } = req.body as { user_note?: string };

    const [existing] = await pool.execute<any[]>(
      "SELECT id FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: "not_found" });

    await pool.execute("UPDATE decision_journal SET user_note = ? WHERE id = ?", [user_note ?? null, id]);
    return res.json({ data: { id: Number(id), userNote: user_note ?? null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// ── Review endpoints ───────────────────────────────────────────────────────────

// POST /api/decisions/:id/reviews
decisionsRouter.post("/:id/reviews", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lang = ((req.query.lang as string) ?? "vi") as "vi" | "en" | "ja";
    const {
      mode,
      current_price: clientCurrentPrice,
      verdict: manualVerdict,
      verdict_reason: manualVerdictReason,
      strengths: manualStrengths,
      weaknesses: manualWeaknesses,
      lessons: manualLessons,
    } = req.body as {
      mode?: string;
      current_price?: number;
      verdict?: string;
      verdict_reason?: string;
      strengths?: string[];
      weaknesses?: string[];
      lessons?: string[];
    };

    // ── Manual review mode ────────────────────────────────────────────────────
    if (mode === "manual") {
      if (!manualVerdict || !["CORRECT", "WRONG", "UNCLEAR"].includes(manualVerdict)) {
        return res.status(400).json({ error: "invalid_verdict" });
      }
      if (!manualVerdictReason || manualVerdictReason.trim().length === 0) {
        return res.status(400).json({ error: "verdict_reason_required" });
      }

      const [entries] = await pool.execute<any[]>(
        "SELECT * FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
        [id]
      );
      if (entries.length === 0) return res.status(404).json({ error: "not_found" });

      const entry = entries[0];
      const decidedAt = new Date(entry.decided_at);
      const diffMs = Date.now() - decidedAt.getTime();
      if (diffMs < 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "too_soon" });
      }

      // Build price snapshot if current_price provided
      let priceSnapshotManual: object | null = null;
      if (clientCurrentPrice != null && entry.entry_price != null) {
        const assetType: string = entry.asset_type ?? "STOCK";
        if (assetType === "STOCK") {
          const { formatDateForVietstock, getHistoricalPrices, buildPriceSnapshot } = await import("../lib/priceService.js");
          const riskPlan = entry.risk_plan
            ? (typeof entry.risk_plan === "string" ? JSON.parse(entry.risk_plan) : entry.risk_plan)
            : null;
          try {
            const startDate = formatDateForVietstock(entry.decided_at);
            const endDate = formatDateForVietstock(new Date().toISOString());
            const history = await getHistoricalPrices(entry.ticker, startDate, endDate).catch(() => []);
            priceSnapshotManual = buildPriceSnapshot(entry.entry_price ?? 0, riskPlan, history, clientCurrentPrice);
          } catch {
            priceSnapshotManual = null;
          }
        } else {
          const { buildNonStockPriceSnapshot } = await import("../lib/priceService.js");
          priceSnapshotManual = buildNonStockPriceSnapshot(entry.entry_price ?? 0, clientCurrentPrice);
        }
      }

      const insertResult = await pool.execute(
        `INSERT INTO decision_review
           (decision_id, reviewed_at, verdict, verdict_reason, strengths, weaknesses, lessons, price_snapshot, model_id, prompt_hash)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(id),
          manualVerdict,
          manualVerdictReason.trim(),
          JSON.stringify(Array.isArray(manualStrengths) ? manualStrengths.filter(Boolean) : []),
          JSON.stringify(Array.isArray(manualWeaknesses) ? manualWeaknesses.filter(Boolean) : []),
          JSON.stringify(Array.isArray(manualLessons) ? manualLessons.filter(Boolean) : []),
          priceSnapshotManual !== null ? JSON.stringify(priceSnapshotManual) : JSON.stringify({}),
          "manual",
          "",
        ]
      );
      const insertId = (insertResult[0] as any).insertId;
      const [newReview] = await pool.execute<any[]>(
        "SELECT * FROM decision_review WHERE id = ?",
        [insertId]
      );
      return res.json({ data: newReview[0] });
    }
    // ── End manual mode ───────────────────────────────────────────────────────


    const [entries] = await pool.execute<any[]>(
      "SELECT * FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (entries.length === 0) return res.status(404).json({ error: "not_found" });

    const entry = entries[0];
    const decidedAt = new Date(entry.decided_at);
    const diffMs = Date.now() - decidedAt.getTime();

    if (diffMs < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "too_soon" });
    }

    const assetType: string = entry.asset_type ?? "STOCK";
    let priceSnapshot: Awaited<ReturnType<typeof buildPriceSnapshot>> | null = null;
    let vnindexHistory: Awaited<ReturnType<typeof getHistoricalPrices>> = [];

    if (assetType === "STOCK") {
      try {
        const startDate = formatDateForVietstock(entry.decided_at);
        const endDate = formatDateForVietstock(new Date().toISOString());
        let currentPrice: number;
        let history: Awaited<ReturnType<typeof getHistoricalPrices>>;
        if (clientCurrentPrice != null) {
          currentPrice = clientCurrentPrice;
        } else {
          const [pbRows] = await pool.execute<any[]>(
            "SELECT current_price FROM paybacktime WHERE StockCode = ?",
            [entry.ticker]
          );
          if (pbRows.length === 0 || pbRows[0].current_price == null) {
            return res.status(503).json({ error: "price_fetch_failed" });
          }
          currentPrice = Number(pbRows[0].current_price);
        }
        try {
          [history, vnindexHistory] = await Promise.all([
            getHistoricalPrices(entry.ticker, startDate, endDate),
            getHistoricalPrices("VNINDEX", startDate, endDate),
          ]);
        } catch {
          history = [];
          vnindexHistory = [];
        }
        const riskPlan = entry.risk_plan
          ? (typeof entry.risk_plan === "string" ? JSON.parse(entry.risk_plan) : entry.risk_plan)
          : null;
        priceSnapshot = buildPriceSnapshot(entry.entry_price ?? 0, riskPlan, history, currentPrice);
      } catch (err) {
        if (err instanceof PriceFetchError) {
          return res.status(503).json({ error: "price_fetch_failed" });
        }
        throw err;
      }
    } else {
      if (clientCurrentPrice != null) {
        priceSnapshot = buildNonStockPriceSnapshot(entry.entry_price ?? 0, clientCurrentPrice);
      }
    }

    let reviewOutput: Awaited<ReturnType<typeof reviewDecision>>;
    try {
      reviewOutput = await reviewDecision(entry, priceSnapshot, lang, Number(id));
    } catch (err) {
      if (err instanceof AIInvalidResponseError) {
        return res.status(502).json({ error: "ai_invalid_response" });
      }
      throw err;
    }

    const snapshotForStorage = priceSnapshot
      ? { ...priceSnapshot, vnindexHistory: vnindexHistory.slice(-30) }
      : null;

    const insertResult = await pool.execute(
      `INSERT INTO decision_review
         (decision_id, reviewed_at, verdict, verdict_reason, strengths, weaknesses, lessons, price_snapshot, model_id, prompt_hash)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(id),
        reviewOutput.verdict,
        reviewOutput.verdictReason,
        JSON.stringify(reviewOutput.strengths),
        JSON.stringify(reviewOutput.weaknesses),
        JSON.stringify(reviewOutput.lessons),
        snapshotForStorage !== null ? JSON.stringify(snapshotForStorage) : JSON.stringify({}),
        reviewOutput.modelId,
        reviewOutput.promptHash ?? "",
      ]
    );
    const insertId = (insertResult[0] as any).insertId;

    const [newReview] = await pool.execute<any[]>(
      "SELECT * FROM decision_review WHERE id = ?",
      [insertId]
    );
    return res.json({ data: newReview[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// GET /api/decisions/:id/reviews
decisionsRouter.get("/:id/reviews", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute<any[]>(
      "SELECT * FROM decision_review WHERE decision_id = ? ORDER BY reviewed_at DESC",
      [id]
    );
    return res.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});
