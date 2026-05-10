# Architecture Overview — bank-dashboard

**Version**: 1.0 (Phase 2 — init-web-dashboard)  
**Date**: 2026-05-08

---

## 1. System Context

```
MySQL (finance.bctc_new)
        │
        ▼
  Express API (Node.js + TypeScript)
  /api/banks
  /api/banks/:code/trend
  /api/ranking
        │
        ▼
  React Frontend (SPA)
  ├── Bank List table
  ├── YoY Trend charts
  └── Cross-Bank Ranking chart
```

No authentication layer. Public dashboard for internal use.

---

## 2. Layers & Responsibilities

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **DB** | MySQL `finance.bctc_new` | Stores raw financials (raw columns) + derived metrics (NPL, LLR, LDR, TangTruongDoanhThu) computed by BEFORE UPDATE trigger `updateValue` |
| **API** | `backend/src/` | DB queries, ranking computation (RANK() OVER), current-period detection via `detectWindow`, data sanitization before response |
| **Frontend** | `frontend/src/` | Rendering only — no business logic. Fetches from API, renders table + charts, handles UI state (selected bank, toggle lines) |

---

## 3. Key Data Flows

### 3.1 Bank List load
1. Frontend calls `GET /api/banks`
2. API runs `detectWindow(new Date())`:
   - If active window → filter `bctc_new` by `(year, quarter)`
   - If null → `SELECT MAX(Year*10+Quarter)` from `bctc_new`, use that as `(year, quarter)`
3. API joins with RANK() window function to produce `total_diem` per bank
4. Returns array sorted by `total_diem DESC`

### 3.2 YoY Trend load
1. Frontend calls `GET /api/banks/:code/trend` (after user selects a bank)
2. API runs two queries for the given `StockCode`:
   - Annual series: `WHERE Quarter = 0 ORDER BY Year ASC`
   - Quarterly series: `WHERE Quarter IN (1,2,3,4) ORDER BY Year ASC, Quarter ASC`
3. Each series includes NPL, LLR, LDR, TangTruongDoanhThu, plus computed `total_diem` via RANK() over all `bctc_new` rows for the matching period type
4. Returns `{ annual: [...], quarterly: [...] }`

### 3.3 Ranking load
1. Frontend calls `GET /api/ranking`
2. API runs RANK() OVER on **full** `bctc_new` (no period filter — matches `cal_diem.sql` design)
3. Returns array sorted by `total_diem DESC`

---

## 4. detectWindow Dependency

`detectWindow(date)` is defined in `bank-analysis/src/scheduler.ts`.

**For this dashboard**: copy the pure function (no FS / DB dependencies) into `backend/src/lib/detectWindow.ts`. Do NOT create a monorepo import dependency on `bank-analysis`.

```typescript
// Returns null when today is outside any crawl window.
// Fallback: use MAX(Year*10+Quarter) from DB.
export function detectWindow(date?: Date): WindowResult | null { ... }
```

---

## 5. Database Schema (relevant subset)

Table: `finance.bctc_new`  
Primary key: `(StockCode, Year, Quarter)`

| Column | Type | Note |
|--------|------|------|
| StockCode | VARCHAR(3) | Bank ticker, e.g. VCB |
| Year | INT | Report year |
| Quarter | INT | 0 = annual, 1–4 = quarterly |
| NPL | DOUBLE NULL | Derived by trigger on UPDATE |
| LLR | INT NULL | Derived by trigger — **INT precision issue**: formula may produce float |
| LDR | DOUBLE NULL | Derived by trigger on UPDATE |
| TangTruongDoanhThu | DOUBLE NULL | Derived by trigger on UPDATE |
| TrichLuyDuPhong, TongChoVay, TongTienGui, DoanhThuNamNgoai, DoanhThuNamNay, NoCoKhaNangMatVon, NoNghiNgo, NoDuoiTieuChuan | INT NULL | Raw input columns |

**Known data quality issue (M2)**: First INSERT hardcodes derived metrics = 0 because `db.ts` passes literal 0. Trigger only fires on UPDATE. Banks crawled only once will have NPL/LLR/LDR/TangTruongDoanhThu = 0 in DB even when raw data exists. Fix: `db.ts` in `bank-analysis` (OI-2b CLOSED, pending execution).

---

## 6. Ranking Logic

Replicated from `cal_diem.sql` as SQL window functions in API query:

```sql
RANK() OVER (ORDER BY NPL DESC)                   AS NPL_diem          -- lower NPL = higher rank
RANK() OVER (ORDER BY LLR ASC)                    AS LLR_diem          -- higher LLR = higher rank (note: ASC means highest value gets rank 1 only if using DENSE_RANK DESC — verify against cal_diem.sql)
RANK() OVER (ORDER BY LDR DESC)                   AS LDR_diem          -- lower LDR = higher rank
RANK() OVER (ORDER BY TangTruongDoanhThu ASC)     AS TangTruongDoanhThu_diem  -- higher growth = higher rank
```

> **CAUTION**: `cal_diem.sql` uses `ORDER BY LLR` (ASC) — this gives RANK=1 to the *lowest* LLR. But the spec says "LLR cao hơn → điểm cao hơn → tốt hơn". This is a known discrepancy to verify against the actual SQL before finalizing the API query. See `gaps` in `report.md`.

NULL handling: if a metric is NULL for a bank, it is excluded from that metric's RANK window (MySQL RANK() OVER ignores NULLs by default in ORDER BY — but confirm behavior). `total_diem` = sum of non-NULL metric ranks.

---

## 7. Project Structure (target)

```
bank-dashboard/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry
│   │   ├── routes/
│   │   │   ├── banks.ts          # GET /api/banks, GET /api/banks/:code/trend
│   │   │   └── ranking.ts        # GET /api/ranking
│   │   ├── db/
│   │   │   ├── connection.ts     # mysql2/promise pool
│   │   │   └── queries.ts        # parameterized query helpers
│   │   └── lib/
│   │       └── detectWindow.ts   # copied from bank-analysis (pure function)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── BankList.tsx
│   │   │   ├── TrendChart.tsx    # wraps Recharts LineChart x2
│   │   │   └── RankingChart.tsx  # wraps Recharts BarChart
│   │   └── api/
│   │       └── client.ts         # fetch wrappers
│   ├── package.json
│   └── tsconfig.json
├── database/                     # existing SQL reference files (read-only)
├── docs/
└── .env.example
```
