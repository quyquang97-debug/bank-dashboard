# Implementation Plan — init-web-dashboard

**Version**: 2.0 (Phase 3 — full plan)  
**Date**: 2026-05-08  
**Status**: READY FOR IMPLEMENTATION — all open questions resolved

---

## 0. Open Questions Resolved (from draft-1.0)

### OQ-1 — total_diem in trend chart

**Decision**: For each data point `(StockCode, Year, Quarter)` in the trend chart, `total_diem` is computed via `RANK() OVER` across **all rows in `bctc_new` that share the same `Quarter` category**:
- Annual chart (Quarter=0): RANK across all `Quarter=0` rows (all years, all banks)
- Quarterly chart (Quarter=1–4): RANK across all `Quarter IN (1,2,3,4)` rows

This differs slightly from `/api/ranking` (which ranks over ALL rows regardless of Quarter). It is not explicitly stated in spec-pack but is the most coherent interpretation of spec §5.2 and architecture §3.2.

> **Note**: If owner wants `/api/ranking` total_diem reused verbatim in trend, this is a scope change — raise as new Open Issue.

### OQ-2 — LLR RANK direction (discrepancy note in overview.md)

**Decision**: `cal_diem.sql` is CORRECT as written. Analysis:
- `RANK() OVER (ORDER BY LLR ASC)` → lowest LLR gets RANK=1, highest LLR gets RANK=N
- Highest RANK=N → largest contribution to `total_diem`
- Spec says "LLR cao hơn → tốt hơn" → largest LLR_diem → ✓

No code change required. The caution note in `overview.md §6` can be disregarded.

### OQ-3 — Chart library

**Decision**: Recharts. Already confirmed in `frontend-conventions.md §1`. No further action.

### OQ-4 — Seed data / CI tests

**Decision**: Out-of-scope for this change per spec-pack §2. Manual smoke test against dev DB only.

---

## 1. Implementation Policy

| # | Policy |
|---|--------|
| P-1 | All RANK computation, period detection (`detectWindow`), and NULL coercion happen in the **backend**. Frontend is render-only. |
| P-2 | NULL values in DB are surfaced as JSON `null`. Frontend renders `null` as `"—"` in table cells and omits the point in charts (`connectNulls={false}`). `0` is valid data and renders as `"0.00%"`. |
| P-3 | NULL metrics are excluded from RANK computation via `CASE WHEN metric IS NULL THEN NULL ELSE RANK() OVER (...) END`. `total_diem = COALESCE(npl_diem,0)+COALESCE(llr_diem,0)+COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0)`. |
| P-4 | `detectWindow` is copied verbatim (lines 19–61 of `bank-analysis/src/scheduler.ts`) into `backend/src/lib/detectWindow.ts` as a standalone pure export. No monorepo import. |
| P-5 | DB credentials only via `process.env`. Never hardcoded. |
| P-6 | One reviewable unit per implementation step. Do not combine unrelated concerns in a single step. |
| P-7 | No features outside spec-pack §2 (no auth, no export, no mobile breakpoints, no alerts). |

---

## 2. Impact Analysis

### 2.1 Existing code to read before implementing

| File | Why | Status |
|------|-----|--------|
| `bank-analysis/src/scheduler.ts` lines 19–61 | Extract pure `detectWindow` function + `WindowResult` interface | ✅ Read |
| `database/cal_diem.sql` | Confirm RANK direction and total_diem formula | ✅ Read |
| `database/create_table.sql` | Confirm exact column names and types for SQL queries | Needed before Step S6 |
| `database/TRIGGER.sql` | Understand derived-column trigger (informs NULL behavior) | Needed before Step S7 |

### 2.2 Files to create (all new — no existing app code)

| File | Step |
|------|------|
| `.env.example` | S1 |
| `backend/package.json` | S2 |
| `backend/tsconfig.json` | S2 |
| `backend/src/index.ts` | S10 |
| `backend/src/routes/banks.ts` | S7, S8 |
| `backend/src/routes/ranking.ts` | S9 |
| `backend/src/db/connection.ts` | S4 |
| `backend/src/db/queries.ts` | S6 |
| `backend/src/lib/detectWindow.ts` | S5 |
| `frontend/package.json` | S3 |
| `frontend/tsconfig.json` | S3 |
| `frontend/vite.config.ts` | S3 |
| `frontend/index.html` | S3 |
| `frontend/src/main.tsx` | S3 |
| `frontend/src/App.tsx` | S15 |
| `frontend/src/components/BankList.tsx` | S12 |
| `frontend/src/components/TrendChart.tsx` | S13 |
| `frontend/src/components/RankingChart.tsx` | S14 |
| `frontend/src/api/client.ts` | S11 |

### 2.3 Existing files impacted

| File | Change |
|------|--------|
| *(none in bank-dashboard)* | Greenfield — no existing app code to modify |
| `bank-analysis/src/db.ts` | **Out-of-scope for this change** — prerequisite backfill (P1/P2) is a separate task |

### 2.4 Infrastructure / environment

| Concern | Requirement |
|---------|-------------|
| MySQL version | ≥ 8.0 (RANK() OVER window functions) |
| Node.js | ≥ 18 (native fetch available; used by frontend build tooling) |
| Ports | Backend: 3001 · Frontend dev server: 5173 |
| CORS | Backend allows `http://localhost:5173` during development |

---

## 3. Prerequisites (before first `npm run dev`)

| # | Task | Owner | Blocker for |
|---|------|-------|-------------|
| P1 | Backfill derived metrics for BID, LPB, TCB, MBB, STB: `UPDATE bctc_new SET StockCode=StockCode WHERE StockCode IN ('BID','LPB','TCB','MBB','STB')` | Data pipeline | Meaningful data in dashboard |
| P2 | Fix `bank-analysis/src/db.ts` to calculate NPL/LLR/LDR/TangTruongDoanhThu before INSERT (prevents future first-INSERT=0 problem) | Data pipeline | Future data quality |
| P3 | Verify MySQL ≥ 8.0: `SELECT VERSION()` | Infra | All RANK() queries |
| P4 | Create `.env` from `.env.example` with dev DB credentials | Developer | Backend startup |
| P5 | Verify `bctc_new` table exists and is accessible with configured credentials | Developer | All API endpoints |

---

## 4. Implementation Steps

### S1 — `.env.example`

**File**: `bank-dashboard/.env.example`

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=finance
PORT=3001
VITE_API_BASE_URL=http://localhost:3001
```

**Acceptance**: File exists at project root. Contains all 6 variables listed in `api-conventions.md §7`.

---

### S2 — Backend scaffolding (`package.json` + `tsconfig.json`)

**File**: `backend/package.json`

```json
{
  "name": "bank-dashboard-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "mysql2": "^3.6.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**File**: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Acceptance**: `cd backend && npm install` completes without errors.

---

### S3 — Frontend scaffolding (Vite + React + TypeScript)

```bash
cd bank-dashboard
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install recharts
npm install --save-dev @types/recharts
```

Add to `frontend/.env` (dev only, gitignored):
```
VITE_API_BASE_URL=http://localhost:3001
```

**Acceptance**: `npm run dev` starts Vite dev server on port 5173. Default Vite page renders.

---

### S4 — `backend/src/db/connection.ts`

```typescript
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});
```

**Acceptance**: Module imports without error. Pool is reused across requests (not created per-request).

---

### S5 — `backend/src/lib/detectWindow.ts`

Copy the `WindowResult` interface and `detectWindow` function verbatim from `bank-analysis/src/scheduler.ts` lines 19–61. Remove all other content (imports, FS, DB references).

```typescript
export interface WindowResult {
  year: number;
  quarter: number;
  lastDay: number;
  isLastDay: boolean;
}

export function detectWindow(date?: Date): WindowResult | null {
  // ... (exact copy of function body) ...
}
```

**Acceptance**: `import { detectWindow } from "./lib/detectWindow.js"` resolves. Function returns `null` when called with a date in February (outside all windows), returns a `WindowResult` when called with e.g. March 20.

---

### S6 — `backend/src/db/queries.ts` — period detection helper

```typescript
import { pool } from "./connection.js";

export interface Period {
  year: number;
  quarter: number;
}

export async function detectCurrentPeriod(overrideDate?: Date): Promise<Period | null> {
  const { detectWindow } = await import("../lib/detectWindow.js");
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
```

**Acceptance**: Returns `WindowResult` period when in a crawl window, MAX period from DB otherwise, `null` when table is empty.

---

### S7 — `backend/src/routes/banks.ts` — GET /api/banks

**Logic**:
1. Call `detectCurrentPeriod()`. If `null` (empty table) → return `{ data: [], meta: { period: null } }`.
2. Run ranking CTE over full `bctc_new`, then filter by `(Year, Quarter)`:

```sql
WITH ranked AS (
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
ORDER BY totalDiem DESC
```

3. Return `{ data: BankRow[], meta: { period: { year, quarter } } }`.

**NULL contract**: Do not coerce NULL → 0. Return `null` in JSON for NULL DB values (see P-2, P-3).

**Response type** (matches `api-conventions.md §4`):
```typescript
interface BankRow {
  stockCode: string;
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number;
}
```

**Acceptance**: `GET /api/banks` returns 200 with `data` array sorted by `totalDiem DESC` and `meta.period` set.

---

### S8 — `backend/src/routes/banks.ts` — GET /api/banks/:code/trend

**Logic**:
1. Validate `:code`: must match `/^[A-Z]{2,4}$/`. Return 400 if invalid.
2. Return 404 if no rows found for that `StockCode`.
3. Annual series query (RANK over all Quarter=0 rows for context):

```sql
WITH ranked AS (
  SELECT
    StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu,
    CASE WHEN NPL IS NULL THEN NULL
         ELSE RANK() OVER (PARTITION BY (Quarter=0) ORDER BY NPL DESC)
    END AS npl_diem,
    CASE WHEN LLR IS NULL THEN NULL
         ELSE RANK() OVER (PARTITION BY (Quarter=0) ORDER BY LLR ASC)
    END AS llr_diem,
    CASE WHEN LDR IS NULL THEN NULL
         ELSE RANK() OVER (PARTITION BY (Quarter=0) ORDER BY LDR DESC)
    END AS ldr_diem,
    CASE WHEN TangTruongDoanhThu IS NULL THEN NULL
         ELSE RANK() OVER (PARTITION BY (Quarter=0) ORDER BY TangTruongDoanhThu ASC)
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
WHERE StockCode = ?
ORDER BY Year ASC
```

4. Quarterly series query: same structure, `WHERE Quarter IN (1,2,3,4)`, label = `CONCAT(Year,'Q',Quarter)`.
5. Return `{ annual: TrendPoint[], quarterly: TrendPoint[] }`.

**Response type** (matches `api-conventions.md §5`):
```typescript
interface TrendPoint {
  year: number;
  quarter: number;
  label: string;
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number;
}
interface TrendResponse {
  annual: TrendPoint[];
  quarterly: TrendPoint[];
}
```

**Acceptance**: `GET /api/banks/VCB/trend` returns 200 with `annual` and `quarterly` arrays. Both may be empty (not null). Returns 400 for `/api/banks/123/trend`.

---

### S9 — `backend/src/routes/ranking.ts` — GET /api/ranking

**Logic**: RANK over full `bctc_new` (no period filter). Same CASE/COALESCE pattern as S7.

```sql
WITH ranked AS (
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
ORDER BY totalDiem DESC
```

**Response type** (matches `api-conventions.md §6`):
```typescript
interface RankingRow {
  stockCode: string;
  npl: number | null; nplDiem: number | null;
  llr: number | null; llrDiem: number | null;
  ldr: number | null; ldrDiem: number | null;
  tangTruongDoanhThu: number | null; tangTruongDoanhThuDiem: number | null;
  totalDiem: number;
}
```

**Acceptance**: `GET /api/ranking` returns 200 with array sorted by `totalDiem DESC`. Single-bank DB returns one row with all four `*Diem` = 1 and `totalDiem` = 4.

---

### S10 — `backend/src/index.ts` — Express server wiring

```typescript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { banksRouter } from "./routes/banks.js";
import { rankingRouter } from "./routes/ranking.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/banks", banksRouter);
app.use("/api/ranking", rankingRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
```

**Acceptance**: `npm run dev` in `backend/` starts without error. `curl http://localhost:3001/api/banks` returns JSON.

---

### S11 — `frontend/src/api/client.ts`

```typescript
const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function fetchBanks() {
  const res = await fetch(`${BASE}/api/banks`);
  if (!res.ok) throw new Error(`/api/banks failed: ${res.status}`);
  return res.json();
}

export async function fetchTrend(code: string) {
  const res = await fetch(`${BASE}/api/banks/${encodeURIComponent(code)}/trend`);
  if (!res.ok) throw new Error(`/api/banks/${code}/trend failed: ${res.status}`);
  return res.json();
}

export async function fetchRanking() {
  const res = await fetch(`${BASE}/api/ranking`);
  if (!res.ok) throw new Error(`/api/ranking failed: ${res.status}`);
  return res.json();
}
```

**Acceptance**: Functions exported. No axios dependency.

---

### S12 — `frontend/src/components/BankList.tsx`

**State**: loading, error, `data: BankRow[]`.  
**Mount**: call `fetchBanks()`.

**Render rules** (per `frontend-conventions.md §3, §4`):
- Loading → spinner or "Đang tải…"
- Error → "Lỗi tải dữ liệu"
- `data.length === 0` → "Không có dữ liệu"
- Otherwise → `<table>` with columns: StockCode, NPL(%), LLR(%), LDR(%), Tăng Trưởng(%), Điểm Tổng
- `null` cells → `"—"`; `0` → `"0.00%"`; number → `toFixed(2) + "%"`
- Row click → call `onSelectBank(stockCode)` prop
- Selected row highlighted via CSS class

**Props**:
```typescript
interface Props {
  onSelectBank: (code: string) => void;
  selectedBank: string | null;
}
```

**Acceptance**: Table renders. NULL cell shows "—". 0 shows "0.00%". Row click triggers `onSelectBank`.

---

### S13 — `frontend/src/components/TrendChart.tsx`

Contains two sub-components `AnnualChart` and `QuarterChart` (can be same file or split — same file preferred to avoid over-engineering).

**Props**:
```typescript
interface Props {
  selectedBank: string | null;
}
```

**Behavior**:
- `selectedBank === null` → placeholder: `"Chọn một ngân hàng từ danh sách để xem xu hướng"`
- On `selectedBank` change → fetch `fetchTrend(selectedBank)`
- Loading → "Đang tải…"
- `annual.length === 0` → hide Chart A, show `"Chưa có dữ liệu báo cáo năm"`
- `quarterly.length === 0` → hide Chart B, show `"Chưa có dữ liệu báo cáo quý"`

**Chart A (annual)**:
- Recharts `<LineChart data={annual}>`
- X axis: `dataKey="label"` (Year string)
- 5 `<Line>` elements: `npl`, `llr`, `ldr`, `tangTruongDoanhThu`, `totalDiem`
- Each line toggleable via checkbox/legend click; default all visible
- `connectNulls={false}` — null points leave gaps

**Chart B (quarterly)**:
- Same structure, `data={quarterly}`, X axis label = `{Year}Q{Quarter}`

**Toggle state**: `Set<string>` of active metric keys; starts as `{ "npl","llr","ldr","tangTruongDoanhThu","totalDiem" }`. Toggling adds/removes from set; `<Line hide={!active.has(key)}>`.

**Acceptance**: Clicking VCB shows both charts. Toggle hides individual lines. Single data point renders dot without crashing.

---

### S14 — `frontend/src/components/RankingChart.tsx`

**State**: loading, error, `data: RankingRow[]`.  
**Mount**: call `fetchRanking()`.

**Render rules**:
- Loading → "Đang tải…"
- Error → "Lỗi tải dữ liệu"
- `data.length === 0` → "Không có dữ liệu"
- Otherwise → Recharts `<BarChart layout="vertical">` (horizontal bars)
  - Y axis: `dataKey="stockCode"`
  - X axis: `totalDiem` value
  - Single bar per bank; sorted by `totalDiem DESC` (API already sorts)

**Acceptance**: Chart renders with banks sorted highest totalDiem at top. Single-bank case renders 1 bar.

---

### S15 — `frontend/src/App.tsx` — wire all components

```typescript
const [selectedBank, setSelectedBank] = useState<string | null>(null);

return (
  <main>
    <h1>Bank Financial Dashboard</h1>
    <BankList onSelectBank={setSelectedBank} selectedBank={selectedBank} />
    <TrendChart selectedBank={selectedBank} />
    <RankingChart />
  </main>
);
```

**Layout**: Vertical stack. Minimum 1280px width. No mobile breakpoints.

**Acceptance**: Page loads. All 3 sections render independently. Selecting a bank shows trend.

---

### S16 — Smoke test

Run:
```bash
cd backend && npm run dev   # :3001
cd frontend && npm run dev  # :5173
```

Open `http://localhost:5173` and verify:
- Bank List renders with correct columns
- NULL cells show "—"; 0 cells show "0.00%"
- Row click shows trend charts
- No selected bank shows placeholder
- Ranking chart renders sorted

Document actual DB state findings in `docs/changes/init-web-dashboard/test-results.md`.

---

## 5. Risks

| # | Rủi ro | Khả năng | Ảnh hưởng | Biện pháp |
|---|--------|----------|-----------|-----------|
| R1 | MySQL < 8.0: RANK() OVER not supported | Thấp | Nghiêm trọng — all ranking fails | Verify via `SELECT VERSION()` before step S7 |
| R2 | M2 banks (BID, LPB, TCB, MBB, STB) still have derived = 0 (prerequisite P1/P2 not done) | Cao | Trung bình — `0` shows as `"0.00%"`, not crash | Documented as expected behavior in smoke test (step S16). Tracker in test-results.md. |
| R3 | NULL in RANK() OVER: MySQL NULL ordering places NULL rows in unexpected rank positions | Trung bình | Cao — wrong totalDiem for banks with NULL metrics | CASE WHEN approach in S7/S8/S9 prevents this. Verify with Abnormal-2 test case. |
| R4 | Recharts crashes on single-point array | Thấp | Thấp | Recharts handles single point natively; `dot={true}` on `<Line>`. Verify with Boundary-3. |
| R5 | CORS misconfiguration: frontend can't reach backend | Thấp | Trung bình — all API calls fail silently | Step S10 adds explicit CORS origin. Check browser console during S16. |

---

## 6. Rollback Procedure

This change creates new files only — no existing code is modified.

**To undo**: delete `backend/` and `frontend/` directories.

```bash
rm -rf bank-dashboard/backend bank-dashboard/frontend
```

The `database/`, `docs/`, and `bank-analysis/` directories are untouched.

---

## 7. Verification Procedure

Run against the cases in `spec-pack.md §8`:

| Test Case | How to verify |
|-----------|--------------|
| Normal-1 (5 banks, correct columns) | Check Bank List table after S16 smoke test |
| Normal-2 (VCB trend 2 charts) | Click VCB, verify Chart A has Year axis, Chart B has `{Year}Q{Quarter}` axis |
| Abnormal-1 (empty DB) | Temporarily point `.env` to empty DB or truncate test DB; verify "Không có dữ liệu" in all 3 sections |
| Abnormal-2 (NULL NPL for TCB) | Query DB for a NULL metric; verify "—" in table, NPL_diem excluded from totalDiem |
| Boundary-1 (1 bank) | Insert only 1 row in test; verify totalDiem = 4 |
| Boundary-2 (TangTruongDoanhThu = 0) | Find bank with 0 growth; verify "0.00%" (not "—") |
| Boundary-3 (1 data point in trend) | Find bank with 1 row; verify dot renders, no crash |

---

## 8. Pre-Implementation Checklist

Before writing the first line of code, confirm:

- [ ] **C1** `SELECT VERSION()` returns 8.0 or higher
- [ ] **C2** `SELECT COUNT(*) FROM finance.bctc_new` > 0 (data exists)
- [ ] **C3** Prerequisite P1 backfill has been run (or explicitly accepted that 0-values will appear as "0.00%" in dashboard)
- [ ] **C4** `.env` created with working DB credentials
- [ ] **C5** `database/create_table.sql` column names match those used in SQL queries (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu, TrichLuyDuPhong, TongChoVay, TongTienGui, NoCoKhaNangMatVon, NoNghiNgo, NoDuoiTieuChuan, DoanhThuNamNgoai, DoanhThuNamNay)
- [ ] **C6** Node.js ≥ 18 is installed (`node --version`)
- [ ] **C7** LLR column type: `overview.md §5` notes `LLR INT NULL` — if the trigger computes a float, stored values will be truncated. Verify actual values in DB before accepting LLR trend data as accurate. (This is a known schema issue, not a blocker for implementation.)
- [ ] **C8** `bank-analysis/src/scheduler.ts` has not changed since this plan was written — re-read lines 19–61 before copying to confirm the function body is current

---

## 9. AC Mapping Table

| AC | Screen / Component | API / Query | File(s) | Step |
|----|-------------------|-------------|---------|------|
| AC-1 (period detection, filter by kỳ mới nhất) | BankList.tsx | GET /api/banks → detectCurrentPeriod() | `routes/banks.ts`, `db/queries.ts`, `lib/detectWindow.ts` | S6, S7 |
| AC-2 (4 chỉ số + total_diem columns) | BankList.tsx | GET /api/banks → BankRow shape | `routes/banks.ts` | S7, S12 |
| AC-2b (sort by total_diem DESC) | BankList.tsx | ORDER BY totalDiem DESC in SQL | `routes/banks.ts` | S7 |
| AC-3 (empty state "Không có dữ liệu") | BankList.tsx, TrendChart.tsx, RankingChart.tsx | data.length === 0 check | `BankList.tsx`, `TrendChart.tsx`, `RankingChart.tsx` | S12, S13, S14 |
| AC-4 (NULL cell → "—") | BankList.tsx | null in JSON | `BankList.tsx` render logic | S12 |
| AC-5 (2 separate trend charts) | TrendChart.tsx | GET /api/banks/:code/trend → { annual, quarterly } | `routes/banks.ts`, `TrendChart.tsx` | S8, S13 |
| AC-6 (X axis Year / YearQQuarter) | TrendChart.tsx | label field in TrendPoint | `routes/banks.ts` (CAST/CONCAT), `TrendChart.tsx` | S8, S13 |
| AC-7 (5 toggleable lines) | TrendChart.tsx | 5 fields in TrendPoint | `TrendChart.tsx` toggle state | S13 |
| AC-8 (hide chart when no data) | TrendChart.tsx | annual/quarterly empty arrays | `TrendChart.tsx` empty-array guard | S13 |
| AC-9-trend (placeholder when no bank selected) | TrendChart.tsx | n/a (UI-only) | `TrendChart.tsx` null-check | S13 |
| AC-10-rank (RANK() + NULL handling) | RankingChart.tsx | GET /api/ranking → CASE WHEN + COALESCE | `routes/ranking.ts` | S9 |
| AC-10 (ranking on full bctc_new, no period filter) | RankingChart.tsx | No WHERE in ranking query | `routes/ranking.ts` | S9 |
| AC-11 (ranking sorted totalDiem DESC) | RankingChart.tsx | ORDER BY totalDiem DESC in SQL + chart sorted | `routes/ranking.ts`, `RankingChart.tsx` | S9, S14 |
| AC-12 (1 bank → totalDiem=4) | RankingChart.tsx | RANK=1 for all 4 metrics when N=1 | `routes/ranking.ts` RANK() behavior | S9 |
