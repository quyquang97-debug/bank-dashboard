import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import type { PriceSnapshot } from "./priceService.js";

export class AIInvalidResponseError extends Error {
  constructor(public promptHash: string) {
    super("AI returned invalid JSON schema after 2 attempts");
    this.name = "AIInvalidResponseError";
  }
}

export interface AIReviewOutput {
  verdict: "CORRECT" | "WRONG" | "UNCLEAR";
  verdictReason: string;
  strengths: string[];
  weaknesses: string[];
  lessons: string[];
  modelId: string;
  promptHash: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PatternResult {
  mistakes: Array<{ description: string; count: number }>;
  successes: Array<{ description: string; count: number }>;
}

interface EntryForReview {
  id: number;
  ticker: string;
  asset_type: string;
  decision_type: string;
  decided_at: string;
  entry_price: number | null;
  volume: number | null;
  quantity: number | null;
  buy_amount: number | null;
  risk_plan: unknown;
  reason: string;
  confidence: number | null;
  mood: string | null;
  sources: string | null;
}

const MODEL_ID = "claude-sonnet-4-6";
const TIMEOUT_MS = 60_000;

function buildReviewPrompt(entry: EntryForReview, snapshot: PriceSnapshot | null, lang: string): string {
  const langLabel = lang === "en" ? "English" : lang === "ja" ? "Japanese" : "Vietnamese";
  return `You are an objective investment decision analyst. Evaluate the following investment decision based on subsequent market performance.

DECISION:
- Ticker: ${entry.ticker}
- Asset type: ${entry.asset_type}
- Type: ${entry.decision_type}
- Decided at: ${entry.decided_at}
- Entry price: ${entry.entry_price ?? "N/A"} VND
- Quantity: ${entry.quantity != null ? entry.quantity + " units" : "N/A"}
- Buy amount: ${entry.buy_amount != null ? entry.buy_amount + " VND" : "N/A"}
- Risk plan: ${JSON.stringify(entry.risk_plan ?? null)}
- Reason: ${entry.reason}
- Confidence: ${entry.confidence ?? "N/A"}/5
- Mood: ${entry.mood ?? "N/A"}
- Sources: ${entry.sources ?? "N/A"}

MARKET PERFORMANCE (from decided_at to now):
- Current price: ${snapshot?.currentPrice ?? "N/A"} VND
- Change vs entry: ${snapshot ? snapshot.changePct.toFixed(2) + "%" : "N/A"}
- Max price in period: ${snapshot?.maxPrice != null ? snapshot.maxPrice + " VND (on " + snapshot.maxDate + ")" : "N/A"}
- Min price in period: ${snapshot?.minPrice != null ? snapshot.minPrice + " VND (on " + snapshot.minDate + ")" : "N/A"}
- Stop-loss hit: ${snapshot?.slHit ?? "N/A"}
- Take-profit levels hit (0-indexed): ${snapshot ? ((snapshot.tpHits ?? []).length > 0 ? (snapshot.tpHits ?? []).join(", ") : "none") : "N/A"}

Respond ONLY in ${langLabel}. Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "verdict": "CORRECT" | "WRONG" | "UNCLEAR",
  "verdict_reason": "1-3 sentence explanation",
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "lessons": ["string", ...]
}
- verdict: CORRECT if the decision led to a good outcome, WRONG if it was a mistake, UNCLEAR if it's too early or ambiguous
- strengths: 1-5 valid points in the reasoning
- weaknesses: 0-5 flaws or mistakes
- lessons: 1-3 actionable lessons for next time`;
}

function buildPatternPrompt(lessonsAndWeaknesses: string[], lang: string): string {
  const langLabel = lang === "en" ? "English" : lang === "ja" ? "Japanese" : "Vietnamese";
  const items = lessonsAndWeaknesses.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `You are an investment behavior analyst. Analyze these lessons and weaknesses collected from multiple investment decision reviews:

${items}

Identify repeating patterns. Only include a pattern if it clearly appears multiple times and has practical significance.

Respond ONLY in ${langLabel}. Return ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "mistakes": [{"description": "pattern description", "count": number}, ...],
  "successes": [{"description": "pattern description", "count": number}, ...]
}`;
}

function validateReviewSchema(obj: unknown): obj is {
  verdict: string;
  verdict_reason: string;
  strengths: string[];
  weaknesses: string[];
  lessons: string[];
} {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const validVerdicts = ["CORRECT", "WRONG", "UNCLEAR"];
  return (
    validVerdicts.includes(o.verdict as string) &&
    typeof o.verdict_reason === "string" &&
    Array.isArray(o.strengths) &&
    Array.isArray(o.weaknesses) &&
    Array.isArray(o.lessons)
  );
}

async function callClaude(
  client: Anthropic,
  prompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const msg = await client.messages.create(
    {
      model: MODEL_ID,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: TIMEOUT_MS }
  );
  const content = msg.content[0].type === "text" ? msg.content[0].text : "";
  return {
    content,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

export async function reviewDecision(
  entry: EntryForReview,
  priceSnapshot: PriceSnapshot | null,
  lang: "vi" | "en" | "ja",
  decisionId: number
): Promise<AIReviewOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildReviewPrompt(entry, priceSnapshot, lang);
  const promptHash = createHash("sha256").update(prompt).digest("hex");
  const start = Date.now();

  async function attempt(retryPrompt: string) {
    return callClaude(client, retryPrompt);
  }

  let raw = await attempt(prompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.content);
  } catch {
    parsed = null;
  }

  if (!validateReviewSchema(parsed)) {
    const retryPrompt =
      prompt +
      "\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object with no other text.";
    raw = await attempt(retryPrompt);
    try {
      parsed = JSON.parse(raw.content);
    } catch {
      parsed = null;
    }
    if (!validateReviewSchema(parsed)) {
      console.error(`[aiService] AI invalid response decision_id=${decisionId} prompt_hash=${promptHash}`);
      throw new AIInvalidResponseError(promptHash);
    }
  }

  const result = parsed as {
    verdict: "CORRECT" | "WRONG" | "UNCLEAR";
    verdict_reason: string;
    strengths: string[];
    weaknesses: string[];
    lessons: string[];
  };

  const latencyMs = Date.now() - start;
  console.log(
    `[aiService] review decision_id=${decisionId} model=${MODEL_ID} latency=${latencyMs}ms input_tokens=${raw.inputTokens} output_tokens=${raw.outputTokens}`
  );

  return {
    verdict: result.verdict,
    verdictReason: result.verdict_reason,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    lessons: result.lessons,
    modelId: MODEL_ID,
    promptHash,
    latencyMs,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
  };
}

export async function analyzePatterns(
  lessonsAndWeaknesses: string[],
  lang: "vi" | "en" | "ja"
): Promise<PatternResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPatternPrompt(lessonsAndWeaknesses, lang);
  const start = Date.now();
  const raw = await callClaude(client, prompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.content);
  } catch {
    parsed = null;
  }
  const p = parsed as Record<string, unknown> | null;
  const latencyMs = Date.now() - start;
  console.log(`[aiService] patterns model=${MODEL_ID} latency=${latencyMs}ms input_tokens=${raw.inputTokens} output_tokens=${raw.outputTokens}`);

  if (!p || !Array.isArray(p.mistakes) || !Array.isArray(p.successes)) {
    return { mistakes: [], successes: [] };
  }
  return { mistakes: p.mistakes as PatternResult["mistakes"], successes: p.successes as PatternResult["successes"] };
}
