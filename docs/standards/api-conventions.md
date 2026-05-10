# API Conventions — bank-dashboard backend

**Version**: 1.0 (Phase 2 — init-web-dashboard)  
**Date**: 2026-05-08

---

## 1. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/banks` | Bank list for current period, sorted by total_diem DESC |
| GET | `/api/banks/:code/trend` | Annual + quarterly timeseries for one bank |
| GET | `/api/ranking` | All banks ranked over full bctc_new dataset |

---

## 2. Response Shape

### Success

```json
{
  "data": <array or object>,
  "meta": { "period": { "year": 2025, "quarter": 1 } }  // optional, for /api/banks
}
```

### Error

```json
{
  "error": "DESCRIPTION"
}
```

HTTP status codes: 200 OK, 400 Bad Request (invalid :code), 404 Not Found, 500 Internal Server Error.

---

## 3. NULL Handling

- NULL numeric values in DB are returned as `null` in JSON (never as `0`).
- Frontend is responsible for rendering `null` as `"—"` in table cells.
- Do NOT coerce NULL to 0 in the API layer.

---

## 4. /api/banks response

```typescript
interface BankRow {
  stockCode: string;
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number | null;
}
```

---

## 5. /api/banks/:code/trend response

```typescript
interface TrendResponse {
  annual: TrendPoint[];     // Quarter=0, ordered by Year ASC
  quarterly: TrendPoint[];  // Quarter=1-4, ordered by Year ASC, Quarter ASC
}

interface TrendPoint {
  year: number;
  quarter: number;         // 0 for annual, 1-4 for quarterly
  label: string;           // "2024" for annual, "2024Q1" for quarterly
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number | null;
}
```

---

## 6. /api/ranking response

```typescript
interface RankingRow {
  stockCode: string;
  npl: number | null;
  nplDiem: number | null;
  llr: number | null;
  llrDiem: number | null;
  ldr: number | null;
  ldrDiem: number | null;
  tangTruongDoanhThu: number | null;
  tangTruongDoanhThuDiem: number | null;
  totalDiem: number | null;
}
```

---

## 7. Environment Variables

```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=finance
PORT=3001
```

Never hardcode DB credentials. Read from `process.env` only.

---

## 8. DB Connection

Use `mysql2/promise` connection pool (not single connection per request). See `backend/src/db/connection.ts`.

---

## 9. CORS

During development: allow `http://localhost:5173` (Vite default). In production, tighten to actual origin.

---

## 10. TypeScript

- Strict mode enabled.
- No `any` except where mysql2 row typing requires it — cast explicitly.
- `tsconfig.json` targets ESNext with `moduleResolution: bundler` or `node16`.
