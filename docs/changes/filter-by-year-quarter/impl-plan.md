# Implementation Plan — filter-by-year-quarter

**Version**: 1.0  
**Date**: 2026-05-09  
**Based on spec**: `spec-pack.md` v1.2 (FINAL)  
**Status**: FINAL — pre-flight checklist đã đóng; sẵn sàng implement

---

## 1. Implementation Policy

### 1.1 Scope constraint

Chỉ implement những gì có trong `spec-pack.md`. Bất kỳ thay đổi nào ngoài spec phải được ghi nhận thành Open Issue mới, không implement đoán mò.

### 1.2 Approach so sánh

| Phương án | Ưu | Nhược | Kết luận |
|-----------|-----|-------|----------|
| **A — Shared helper + inline route logic** | Đơn giản, mỗi route file tự chứa logic, dễ review | Lặp lại nhẹ ở route handlers | **Chọn** |
| B — Express middleware validation | DRY hơn | Thêm tầng abstraction không cần thiết cho 3 endpoint | Không chọn |
| C — DB query layer trả về error | Giữ route mỏng | Pha trộn validation với query logic | Không chọn |

**Quyết định**: Thêm `parsePeriodParams()` vào `backend/src/db/queries.ts` làm shared helper. Mỗi route handler gọi helper này, xử lý kết quả, rồi inject params vào SQL.

### 1.3 AbortController policy

- Mỗi component tự tạo `AbortController` trong `useEffect` cleanup.
- Tất cả `client.ts` functions được cập nhật nhận optional `signal?: AbortSignal` parameter.
- `signal` được forward vào native `fetch()`.
- Nếu fetch bị abort, component ignore lỗi `AbortError` (không set error state).

### 1.4 selectedPeriod initialization flow

```
App mount
  ├── fetch /api/periods (parallel)
  └── fetch /api/banks (no params, để server detect current period)
        └── on success: setSelectedPeriod(meta.period ?? periods[0] ?? null)
```

- Hai fetch chạy **song song** (NFR-1).
- Nếu `meta.period` không null → dùng làm `selectedPeriod`.
- Nếu `meta.period` null → dùng `periods[0]` (nếu có).
- Nếu `periods` rỗng → `selectedPeriod` = null, dropdown hiển thị "Không có dữ liệu".
- Khi `selectedPeriod` được set lần đầu từ `meta.period`, **không trigger re-fetch** BankList (dữ liệu đã khớp với server-detected period). Logic: chỉ re-fetch khi user chủ động đổi dropdown.

> **Note**: Điều này khác với việc set selectedPeriod rồi BankList tự re-fetch. BankList chỉ re-fetch khi `selectedPeriod` thay đổi sau lần khởi tạo đầu tiên. Xem Step F4 để biết cách phân biệt "init" vs "user change".

### 1.5 Loading + stale data policy (AC-5)

Khi filter thay đổi: `setData([])` + `setLoading(true)` trước khi fetch mới. Không giữ dữ liệu cũ trong khi đang tải.

---

## 2. Impact Analysis

### 2.1 Existing code cần đọc (đã đọc)

| File | Lý do đọc | Kết quả |
|------|-----------|---------|
| `backend/src/routes/banks.ts` | Hiểu query hiện tại, điểm inject params | ✅ Đã đọc |
| `backend/src/routes/ranking.ts` | Hiểu query hiện tại | ✅ Đã đọc |
| `backend/src/db/queries.ts` | Xác định nơi thêm helper | ✅ Đã đọc |
| `backend/src/index.ts` | Nơi đăng ký routes mới | ✅ Đã đọc |
| `frontend/src/App.tsx` | Nơi thêm selectedPeriod state | ✅ Đã đọc |
| `frontend/src/api/client.ts` | Nơi thêm fetchPeriods + update signatures | ✅ Đã đọc |
| `frontend/src/components/BankList.tsx` | Nơi thêm selectedPeriod prop + AbortController | ✅ Đã đọc |
| `frontend/src/components/RankingChart.tsx` | Nơi thêm selectedPeriod prop + AbortController | ✅ Đã đọc |
| `frontend/src/components/TrendChart.tsx` | Nơi thêm selectedPeriod prop + AbortController | ✅ Đã đọc |

### 2.2 Files bị ảnh hưởng (modified)

| File | Loại thay đổi |
|------|--------------|
| `backend/src/db/queries.ts` | Thêm `parsePeriodParams()` export |
| `backend/src/routes/banks.ts` | Update 2 handlers: `GET /` + `GET /:code/trend` |
| `backend/src/routes/ranking.ts` | Update handler `GET /` |
| `backend/src/index.ts` | Đăng ký route `/api/periods` |
| `frontend/src/api/client.ts` | Update 3 hàm hiện có + thêm `fetchPeriods()` |
| `frontend/src/App.tsx` | Thêm state, fetch periods, render PeriodFilter |
| `frontend/src/components/BankList.tsx` | Thêm `selectedPeriod` prop, AbortController, empty state |
| `frontend/src/components/RankingChart.tsx` | Thêm `selectedPeriod` prop, AbortController, empty state |
| `frontend/src/components/TrendChart.tsx` | Thêm `selectedPeriod` prop, AbortController |

### 2.3 Files mới (created)

| File | Lý do |
|------|-------|
| `backend/src/routes/periods.ts` | Route mới `GET /api/periods` |
| `frontend/src/components/PeriodFilter.tsx` | Dropdown component (PascalCase theo frontend-conventions) |

### 2.4 Files KHÔNG bị ảnh hưởng

| File | Lý do |
|------|-------|
| `backend/src/db/connection.ts` | Pool config không đổi |
| `backend/src/lib/detectWindow.ts` | Logic không đổi; vẫn dùng trong `detectCurrentPeriod()` |
| `frontend/src/main.tsx` | Không đổi |
| `frontend/src/index.css`, `App.css` | Styling — sẽ thêm nếu cần, nhưng không bắt buộc |
| DB schema `bctc_new` | Không thay đổi schema |
| Logs / permissions / env vars | Không có thay đổi |

---

## 3. Detailed Changes

### 3.1 Backend: `parsePeriodParams` helper

**File**: `backend/src/db/queries.ts`

```typescript
export type PeriodParamsResult =
  | { type: 'ok'; year: number; quarter: number }
  | { type: 'missing' }   // no params — use server default
  | { type: 'invalid' };  // params present but fail validation

export function parsePeriodParams(
  query: Record<string, string | string[] | undefined>
): PeriodParamsResult {
  const yearStr = typeof query.year === 'string' ? query.year : undefined;
  const qStr    = typeof query.quarter === 'string' ? query.quarter : undefined;

  if (yearStr === undefined && qStr === undefined) return { type: 'missing' };
  if (yearStr === undefined || qStr === undefined) return { type: 'invalid' };

  const year    = Number(yearStr);
  const quarter = Number(qStr);

  if (!Number.isInteger(year) || year < 1900 || year > 2100) return { type: 'invalid' };
  if (!Number.isInteger(quarter) || quarter < 0 || quarter > 4) return { type: 'invalid' };

  return { type: 'ok', year, quarter };
}
```

### 3.2 Backend: `GET /api/periods`

**File mới**: `backend/src/routes/periods.ts`

SQL:
```sql
SELECT DISTINCT Year, Quarter
FROM bctc_new
ORDER BY Year DESC, Quarter DESC
```

Response: `{ "data": [{ "year": 2025, "quarter": 1 }, ...] }`

**File**: `backend/src/index.ts`

```typescript
import { periodsRouter } from "./routes/periods.js";
// ...
app.use("/api/periods", periodsRouter);
```

### 3.3 Backend: `GET /api/banks` với params

**File**: `backend/src/routes/banks.ts` — handler `banksRouter.get("/")`

Logic:
- Parse params via `parsePeriodParams(req.query)`
- `type: 'invalid'` → HTTP 400 `{ "error": "Invalid year or quarter" }`
- `type: 'missing'` → giữ nguyên behavior hiện tại (`detectCurrentPeriod()`)
- `type: 'ok'` → dùng `(year, quarter)` làm filter **trong CTE** (cùng pattern với ranking) để RANK() chỉ tính trên rows của kỳ đó — **within-period RANK()** (đã xác nhận PF-1)

**Thay đổi so với hiện tại**: Query hiện tại tính RANK() global rồi filter ở outer WHERE. Sau thay đổi: khi có params, WHERE `Year=? AND Quarter=?` được đặt **trong CTE** trước các window functions. Khi không có params (`type: 'missing'`): giữ nguyên query cũ (RANK() global, filter outer WHERE) để backward compat.

### 3.4 Backend: `GET /api/ranking` với params

**File**: `backend/src/routes/ranking.ts`

Logic:
- Parse params via `parsePeriodParams(req.query)`
- `type: 'invalid'` → HTTP 400
- `type: 'missing'` → RANK() trên toàn bộ `bctc_new` (behavior hiện tại)
- `type: 'ok'` → thêm `WHERE Year = ? AND Quarter = ?` **vào trong CTE** (trước RANK() windows) để RANK() chỉ tính trên rows của kỳ đó

SQL khi có params:
```sql
WITH ranked AS (
  SELECT StockCode, NPL, LLR, LDR, TangTruongDoanhThu,
    CASE WHEN NPL IS NULL THEN NULL ELSE RANK() OVER (ORDER BY NPL DESC) END AS npl_diem,
    ...
  FROM bctc_new
  WHERE Year = ? AND Quarter = ?   -- <-- thêm vào đây
)
SELECT ... FROM ranked ORDER BY totalDiem DESC
```

### 3.5 Backend: `GET /api/banks/:code/trend` với cutoff

**File**: `backend/src/routes/banks.ts` — handler `banksRouter.get("/:code/trend")`

Cutoff logic (theo spec 5.5):

| Selected Q | Annual filter | Quarterly filter |
|-----------|--------------|-----------------|
| Q = 0 | `Year ≤ Y` | `Year ≤ Y` |
| Q > 0 | `Year ≤ Y` | `Year*10+Quarter ≤ Y*10+Q` |

Implementation: thêm điều kiện WHERE vào outer SELECT của mỗi query (không vào CTE — RANK() window vẫn tính trên toàn bộ dữ liệu cùng loại).

```sql
-- Annual query, outer WHERE khi có params:
WHERE StockCode = ? AND Year <= ?

-- Quarterly query, outer WHERE khi Q > 0:
WHERE StockCode = ? AND (Year * 10 + Quarter) <= ?

-- Quarterly query, outer WHERE khi Q = 0:
WHERE StockCode = ? AND Year <= ?
```

### 3.6 Frontend: `client.ts` updates

```typescript
// Thêm Period type
export interface Period { year: number; quarter: number }

// Cập nhật signatures
export async function fetchBanks(period?: Period, signal?: AbortSignal): Promise<any>
export async function fetchTrend(code: string, period?: Period, signal?: AbortSignal): Promise<any>
export async function fetchRanking(period?: Period, signal?: AbortSignal): Promise<any>

// Thêm mới
export async function fetchPeriods(signal?: AbortSignal): Promise<any>
```

URL construction: dùng `URLSearchParams` để build query string khi `period` có giá trị.

### 3.7 Frontend: `PeriodFilter` component

**File mới**: `frontend/src/components/PeriodFilter.tsx`

```typescript
interface Props {
  periods: Period[];
  selected: Period | null;
  onChange: (period: Period) => void;
}
```

Label logic:
- `quarter === 0` → `"{year} (Năm)"`
- `quarter > 0` → `"Q{quarter}/{year}"`

Empty state: khi `periods.length === 0` → disabled select hiển thị "Không có dữ liệu".

### 3.8 Frontend: `App.tsx` changes

- Thêm `const [periods, setPeriods] = useState<Period[]>([])`
- Thêm `const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)`
- Trên mount: fetch `/api/periods` và `/api/banks` (no params) **song song**
- Khi banks response về: set `selectedPeriod` từ `meta.period` (nếu không null). Nếu null → dùng `periods[0]` (nếu có).
- App **không** lưu data từ lần fetch banks đầu tiên — data đó BankList tự fetch (với selectedPeriod=null).
- Render `<PeriodFilter>` phía trên section "Danh Sách Ngân Hàng"
- Pass `selectedPeriod` vào `<BankList>`, `<RankingChart>`, `<TrendChart>`

### 3.9 Frontend: `BankList.tsx` changes

- Thêm `selectedPeriod: Period | null` vào Props
- `useEffect` deps: `[selectedPeriod]`
- Tạo `AbortController` trong useEffect, cleanup `abort()` on unmount/dep change
- **No-double-fetch mechanism** (đã xác nhận PF-2): dùng `useRef` để track giá trị period trước:

```typescript
const prevPeriodRef = useRef<Period | null | undefined>(undefined);

useEffect(() => {
  const prev = prevPeriodRef.current;
  prevPeriodRef.current = selectedPeriod;

  // Skip khi selectedPeriod vừa được init từ null (App set meta.period lần đầu)
  // Data từ fetch null đã đúng với period này — không cần re-fetch
  if (prev === null && selectedPeriod !== null) return;

  const controller = new AbortController();
  setData([]);
  setLoading(true);
  fetchBanks(selectedPeriod ?? undefined, controller.signal)
    .then(res => setData(res.data ?? []))
    .catch(err => { if (err.name !== 'AbortError') setError(true); })
    .finally(() => setLoading(false));
  return () => controller.abort();
}, [selectedPeriod]);
```

- Empty state với `data.length === 0` sau khi load: `"Không có dữ liệu cho kỳ này"`

### 3.10 Frontend: `RankingChart.tsx` changes

Cùng pattern với BankList — kể cả `prevPeriodRef` để tránh double fetch khi init:
- Thêm `selectedPeriod` prop
- `prevPeriodRef` + skip logic giống BankList
- AbortController
- `setData([])` khi fetch mới
- Gọi `fetchRanking(selectedPeriod ?? undefined, controller.signal)`
- Empty state: `"Không có dữ liệu cho kỳ này"`

### 3.11 Frontend: `TrendChart.tsx` changes

- Thêm `selectedPeriod: Period | null` vào Props
- `useEffect` deps: `[selectedBank, selectedPeriod]`
- Tạo AbortController, cleanup on dep change
- `setData(null)` + `setLoading(true)` khi bắt đầu fetch mới
- Gọi `fetchTrend(selectedBank, selectedPeriod ?? undefined, controller.signal)`

---

## 4. Implementation Steps

> Nguyên tắc: **1 step = 1 đơn vị có thể review độc lập**. Mỗi step commit riêng.

### Phase 1: Backend

| # | Step | Files thay đổi | Verify |
|---|------|---------------|--------|
| **B1** | Thêm `parsePeriodParams()` + `PeriodParamsResult` type vào `queries.ts` | `backend/src/db/queries.ts` | Unit test thủ công: gọi với missing/invalid/valid params; TypeScript compile pass |
| **B2** | Tạo `backend/src/routes/periods.ts` với `GET /api/periods` | `backend/src/routes/periods.ts` | `curl http://localhost:3001/api/periods` → `{ "data": [...] }` |
| **B3** | Đăng ký `/api/periods` router trong `index.ts` | `backend/src/index.ts` | Server restart, endpoint accessible |
| **B4** | Update `GET /api/banks` để nhận year/quarter params | `backend/src/routes/banks.ts` | `curl .../api/banks?year=2024&quarter=4` → data kỳ Q4/2024; `curl .../api/banks?year=abc&quarter=1` → 400; `curl .../api/banks` (no params) → vẫn hoạt động |
| **B5** | Update `GET /api/ranking` để nhận year/quarter params | `backend/src/routes/ranking.ts` | Tương tự B4; verify RANK() within-period khi có params |
| **B6** | Update `GET /api/banks/:code/trend` với cutoff logic | `backend/src/routes/banks.ts` | `curl .../api/banks/VCB/trend?year=2024&quarter=4` → chỉ data ≤ 2024Q4; `?year=2023&quarter=0` → quarterly có Year≤2023; `?year=invalid` → 400; no params → toàn bộ lịch sử |

### Phase 2: Frontend — API client

| # | Step | Files thay đổi | Verify |
|---|------|---------------|--------|
| **F1** | Thêm `Period` type + `fetchPeriods()` + cập nhật 3 hàm hiện có với optional `period` và `signal` params | `frontend/src/api/client.ts` | TypeScript compile pass; existing calls vẫn build (backward-compatible signatures) |

### Phase 3: Frontend — Components

| # | Step | Files thay đổi | Verify |
|---|------|---------------|--------|
| **F2** | Tạo `PeriodFilter.tsx` component | `frontend/src/components/PeriodFilter.tsx` | Render storybook-style hoặc tạm thời hardcode trong App để kiểm tra labels |
| **F3** | Update `BankList.tsx`: thêm `selectedPeriod` prop, AbortController, empty state message | `frontend/src/components/BankList.tsx` | Component nhận selectedPeriod prop, TypeScript compile pass |
| **F4** | Update `RankingChart.tsx`: thêm `selectedPeriod` prop, AbortController, empty state message | `frontend/src/components/RankingChart.tsx` | Cùng pattern |
| **F5** | Update `TrendChart.tsx`: thêm `selectedPeriod` prop, AbortController | `frontend/src/components/TrendChart.tsx` | TypeScript compile pass |

### Phase 4: Integration — App.tsx

| # | Step | Files thay đổi | Verify |
|---|------|---------------|--------|
| **F6** | Update `App.tsx`: thêm state, fetch song song, render PeriodFilter, pass selectedPeriod xuống components | `frontend/src/App.tsx` | Full integration test (xem mục 6) |

> **Thứ tự**: Phase 1 → Phase 2 → Phase 3 → Phase 4. Trong Phase 1 và Phase 3, các steps không có dependency — có thể thực hiện theo thứ tự liệt kê nhưng không cần batch.

---

## 5. SQL Reference

### `GET /api/periods`

```sql
SELECT DISTINCT Year, Quarter
FROM bctc_new
ORDER BY Year DESC, Quarter DESC
```

### `GET /api/banks?year=Y&quarter=Q`

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
  WHERE Year = ? AND Quarter = ?   -- within-period: RANK() chỉ trên rows của kỳ này
)
SELECT
  StockCode AS stockCode,
  NPL AS npl, LLR AS llr, LDR AS ldr,
  TangTruongDoanhThu AS tangTruongDoanhThu,
  COALESCE(npl_diem, 0) + COALESCE(llr_diem, 0)
    + COALESCE(ldr_diem, 0) + COALESCE(ttt_diem, 0) AS totalDiem
FROM ranked
ORDER BY totalDiem DESC
```

> Khi **không có params** (`type: 'missing'`): giữ nguyên query cũ (WHERE ở outer, RANK() global) để backward compat với `detectCurrentPeriod()` flow.

### `GET /api/ranking?year=Y&quarter=Q`

```sql
WITH ranked AS (
  SELECT
    StockCode, NPL, LLR, LDR, TangTruongDoanhThu,
    CASE WHEN NPL IS NULL THEN NULL
         ELSE RANK() OVER (ORDER BY NPL DESC)
    END AS npl_diem,
    ...
  FROM bctc_new
  WHERE Year = ? AND Quarter = ?   -- <-- within CTE để RANK() chỉ trên kỳ này
)
SELECT ... FROM ranked ORDER BY totalDiem DESC
```

### `GET /api/banks/:code/trend?year=Y&quarter=Q`

**Annual query outer WHERE**:
```sql
WHERE StockCode = ? AND Year <= ?   -- cùng cho cả Q=0 và Q>0
```

**Quarterly query outer WHERE** (Q > 0):
```sql
WHERE StockCode = ? AND (Year * 10 + Quarter) <= ?  -- giá trị: Y*10+Q
```

**Quarterly query outer WHERE** (Q = 0):
```sql
WHERE StockCode = ? AND Year <= ?
```

---

## 6. Risks

| # | Rủi ro | Biện pháp |
|---|--------|-----------|
| R1 | `parsePeriodParams` không xử lý đúng array query params (`?year=1&year=2`) | Dùng `typeof query.year === 'string'` — array sẽ là `string[]`, sẽ bị treat là invalid |
| R2 | Double fetch khi init: banks fetch (no params) → meta.period set → BankList re-fetch | `prevPeriodRef` trong BankList/RankingChart — skip re-fetch khi transition `null → first period` |
| R3 | Race condition: BankList, RankingChart, TrendChart fetch cùng lúc khi đổi period | AbortController trong mỗi component — request cũ bị cancel |
| R4 | `AbortError` bị treat là network error → show error state | Catch AbortError riêng: `if (err.name === 'AbortError') return;` |
| R5 | Trend endpoint: khi không có selectedBank nhưng selectedPeriod thay đổi → TrendChart không fetch | Đúng — TrendChart guard `if (!selectedBank) return;` trong useEffect |
| R6 | Backward compat regression: hiện tại `/api/banks` handler nhận `_req` (unused) → sau khi sửa phải nhận `req` | Rename tham số từ `_req` sang `req` trong handler |

---

## 7. Rollback

Feature này chỉ **thêm** optional params vào endpoints hiện có. Rollback strategy:

1. **Backend rollback**: Revert `banks.ts`, `ranking.ts`, `queries.ts`, xóa `periods.ts`, revert `index.ts`. Behavior cũ được khôi phục hoàn toàn.
2. **Frontend rollback**: Revert `App.tsx`, `client.ts`, `BankList.tsx`, `RankingChart.tsx`, `TrendChart.tsx`, xóa `PeriodFilter.tsx`. App hoạt động như trước.
3. Không có DB migration → không cần DB rollback.

---

## 8. Verification Procedure

### 8.1 Backend (thủ công với curl)

```bash
# B2/B3: /api/periods
curl http://localhost:3001/api/periods
# → { "data": [{ "year": ..., "quarter": ... }, ...] }

# B4: /api/banks với params
curl "http://localhost:3001/api/banks?year=2024&quarter=4"   # → data kỳ Q4/2024
curl "http://localhost:3001/api/banks?year=abc&quarter=1"    # → 400
curl "http://localhost:3001/api/banks?year=2024"             # → 400 (thiếu quarter)
curl "http://localhost:3001/api/banks"                       # → behavior hiện tại

# B5: /api/ranking
curl "http://localhost:3001/api/ranking?year=2024&quarter=4"  # → RANK within-period
curl "http://localhost:3001/api/ranking?year=1899&quarter=1"  # → 400
curl "http://localhost:3001/api/ranking"                      # → behavior hiện tại

# B6: /api/banks/:code/trend
curl "http://localhost:3001/api/banks/VCB/trend?year=2024&quarter=4"
# → annual: Year<=2024, quarterly: Year*10+Quarter<=20244
curl "http://localhost:3001/api/banks/VCB/trend?year=2023&quarter=0"
# → annual: Year<=2023, quarterly: Year<=2023
curl "http://localhost:3001/api/banks/VCB/trend?year=invalid" # → 400
curl "http://localhost:3001/api/banks/VCB/trend"              # → toàn bộ lịch sử
```

### 8.2 Frontend (browser)

Checklist UI theo AC:

- [ ] **AC-1**: Dropdown có dữ liệu từ DB (không hardcode)
- [ ] **AC-2**: Default = kỳ hiện tại (khớp với meta.period của banks)
- [ ] **AC-3**: Labels đúng format: "Q4/2024", "2023 (Năm)"
- [ ] **AC-4**: Đổi dropdown → BankList + RankingChart tải lại đồng thời
- [ ] **AC-5**: Khi đang tải, dữ liệu cũ không hiển thị (table/chart trống)
- [ ] **AC-6**: Chọn kỳ không có data → hiển thị "Không có dữ liệu cho kỳ này"
- [ ] **AC-20**: Bank đang chọn → đổi period → Trend tải lại, chỉ hiển thị đến cutoff
- [ ] **AC-21**: Chọn Q=0 → Trend A (annual ≤ Y), Trend B (quarterly Year ≤ Y)
- [ ] **Boundary-3**: Đổi filter nhanh liên tiếp → chỉ hiển thị kết quả của lần cuối

### 8.3 Regression checks

- [ ] Khi không đổi filter (load lần đầu), behavior giống hệt trước khi có feature này
- [ ] Select bank vẫn hoạt động sau khi có PeriodFilter
- [ ] Metric toggles trong TrendChart vẫn hoạt động
- [ ] Khi không có bank được chọn, TrendChart vẫn hiển thị placeholder

---

## 9. AC Mapping Table

| AC | Satisfied by | Files |
|----|-------------|-------|
| AC-1 | F2 (PeriodFilter) + F6 (App fetch /api/periods) | `PeriodFilter.tsx`, `App.tsx`, `client.ts` |
| AC-2 | F6 (App set selectedPeriod từ meta.period) | `App.tsx` |
| AC-3 | F2 (PeriodFilter label logic) | `PeriodFilter.tsx` |
| AC-4 | F3 + F4 (BankList + RankingChart refetch on selectedPeriod change) | `BankList.tsx`, `RankingChart.tsx` |
| AC-5 | F3 + F4 (setData([]) before new fetch) | `BankList.tsx`, `RankingChart.tsx` |
| AC-6 | F3 + F4 (empty state message khi data=[]) | `BankList.tsx`, `RankingChart.tsx` |
| AC-7 | B2 + B3 (/api/periods endpoint) | `routes/periods.ts`, `index.ts` |
| AC-8 | B2 (trả về data:[] khi bctc_new rỗng) | `routes/periods.ts` |
| AC-9 | B4 (/api/banks với year/quarter params) | `routes/banks.ts` |
| AC-10 | B1 + B4 (parsePeriodParams → 400) | `queries.ts`, `routes/banks.ts` |
| AC-11 | B4 (missing params → detectCurrentPeriod()) | `routes/banks.ts` |
| AC-14 | B5 (/api/ranking với within-period RANK()) | `routes/ranking.ts` |
| AC-15 | B1 + B5 (parsePeriodParams → 400) | `queries.ts`, `routes/ranking.ts` |
| AC-16 | B5 (missing params → full dataset) | `routes/ranking.ts` |
| AC-17 | B6 (trend cutoff logic) | `routes/banks.ts` |
| AC-18 | B1 + B6 (parsePeriodParams → 400) | `queries.ts`, `routes/banks.ts` |
| AC-19 | B6 (missing params → full history) | `routes/banks.ts` |
| AC-20 | F5 + F6 (TrendChart refetch when selectedPeriod changes) | `TrendChart.tsx`, `App.tsx` |
| AC-21 | B6 (Q=0 cutoff: quarterly filter Year≤Y) + F5 (TrendChart renders) | `routes/banks.ts`, `TrendChart.tsx` |

---

## 10. Pre-flight Checklist — ✅ ALL CLEAR

| # | Câu hỏi | Kết quả | Impact |
|---|---------|---------|--------|
| **PF-1** | `totalDiem` trong bank list: global hay within-period RANK()? | **Within-period** (xác nhận 2026-05-09) | SQL B4: WHERE vào CTE |
| **PF-2** | BankList có re-fetch khi selectedPeriod init từ meta.period? | **Không** (xác nhận 2026-05-09) | `prevPeriodRef` skip logic ở F3/F4 |
| **PF-3** | Trend RANK() window (`PARTITION BY (Quarter=0)`) không thay đổi? | **Đúng, không thay đổi** (xác nhận 2026-05-09) | B6: chỉ thêm WHERE cutoff, không đụng CTE |
| **PF-4** | Annual cutoff luôn `Year ≤ Y` bất kể selected Q? | **Tự xác nhận** — khớp spec 5.5 + Boundary-4 | B6: annual WHERE `Year <= ?` cùng cho cả Q=0 và Q>0 |

**→ Sẵn sàng implement. Không còn câu hỏi mở.**
