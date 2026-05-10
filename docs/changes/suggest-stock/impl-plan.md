# Implementation Plan — suggest-stock (Tab "Sàng Lọc Cổ Phiếu")

**Version**: 1.0  
**Date**: 2026-05-10  
**Spec ref**: `docs/changes/suggest-stock/spec-pack.md` v1.0  
**Status**: Ready for implementation

---

## 1. Policy

### 1.1 Nguyên tắc chung

| # | Policy |
|---|--------|
| P-1 | Mỗi step = một đơn vị có thể review độc lập (file mới hoặc thay đổi nhỏ vào file hiện có). |
| P-2 | Không sửa bất kỳ route / component hiện có ngoài danh sách ở §3.2 — tuân thủ NFR-8. |
| P-3 | Mọi ngưỡng / trọng số / cap phải import từ `screeningConfig.ts` — không hardcode trong route handler. |
| P-4 | Screening route query DB trực tiếp qua `pool` (không HTTP self-call đến `/api/ranking/history` hay `/api/valuation`). Lý do: tránh network round-trip nội bộ và coupling giữa routes. |
| P-5 | Validation của screening route viết inline (không reuse `parsePeriodParams`). Lý do: `parsePeriodParams` không phân biệt "thiếu year" vs "thiếu quarter" vs "sai giá trị" — nhưng spec yêu cầu error message cụ thể từng trường hợp (§5.2.1). |
| P-6 | `ScreeningTab` tự quản lý state `periods` + `selectedPeriod` (self-contained). Lý do: spec §5.4 yêu cầu mount → fetchPeriods → set default → fetchScreening trong component, không phụ thuộc prop từ App. |
| P-7 | `S_val` formula dùng đúng spec: `(clamp(ti, -TI_CAP, +TI_CAP) + TI_CAP) / (2 * TI_CAP) * 100`. Khi `TI_CAP = 0.5` kết quả bằng `(ti_capped + 0.5) * 100` — không viết magic number trong code. |
| P-8 | Làm tròn `s_rank`, `s_val`, `score` đến 2 chữ số thập phân tại tầng API response (dùng `Math.round(x * 100) / 100`). `totalDiem`, `ti_suat_sinh_loi`, `current_price`, `MOS` giữ raw. |
| P-9 | `computed_at` = `new Date().toISOString()` sau khi hoàn thành pipeline. |
| P-10 | Sort: `.sort((a, b) => b.score - a.score \|\| a.stockCode.localeCompare(b.stockCode))` — đảm bảo deterministic (NFR-5). |

### 1.2 Lý do không dùng `parsePeriodParams`

`parsePeriodParams` (trong `backend/src/db/queries.ts`) trả `{ type: "missing" }` khi **cả hai** param đều vắng, và `{ type: "invalid" }` khi chỉ thiếu một. Screening spec yêu cầu:
- Thiếu `year` → `400 { error: "year is required" }`
- Thiếu `quarter` → `400 { error: "quarter is required" }`  
- `quarter = 5` → `400 { error: "quarter must be one of 0,1,2,3,4" }`
- `year = abc` → `400 { error: "year must be an integer" }`

Phải validate từng field riêng biệt.

---

## 2. Impact Analysis

### 2.1 Existing code đã đọc (pre-impl)

| File | Lý do đọc | Kết quả |
|------|-----------|---------|
| `backend/src/index.ts` | Xem pattern đăng ký router, import style | Dùng named import + `app.use("/api/...", router)` |
| `backend/src/routes/ranking.ts` | Lấy SQL query cho ranking history | `GET /api/ranking/history` → `{ data: [{ year, quarter, stockCode, totalDiem }] }` |
| `backend/src/routes/valuation.ts` | Lấy SQL query cho valuation | `SELECT StockCode, MOS, current_price, ti_suat_sinh_loi FROM paybacktime` |
| `backend/src/routes/periods.ts` | Hiểu source của periods | `SELECT DISTINCT Year, Quarter FROM bctc_new ORDER BY Year DESC, Quarter DESC` |
| `backend/src/db/queries.ts` | Xem `parsePeriodParams` có tái dùng được không | Không tái dùng — xem lý do ở §1.2 |
| `frontend/src/api/client.ts` | Xem pattern fetch, base URL, error handling | Throw khi `!res.ok`, dùng `import.meta.env.VITE_API_BASE_URL` |
| `frontend/src/App.tsx` | Xem pattern tab navigator, state management | `activeTab` union type, tab buttons loop, conditional render |
| `frontend/src/components/PeriodFilter.tsx` | Props interface, re-use contract | `{ periods: Period[], selected: Period \| null, onChange: (p: Period) => void }` |
| `frontend/src/components/ValuationTab.tsx` | Pattern UIState, loading/error/result | `type UIState = \| { kind: "loading" } \| { kind: "error" } \| { kind: "result"; rows }` |

### 2.2 Files sẽ bị thay đổi

| File | Loại thay đổi | Chi tiết |
|------|--------------|---------|
| `backend/src/index.ts` | Modified | +1 import, +1 `app.use("/api/screening", screeningRouter)` |
| `frontend/src/api/client.ts` | Modified | +2 interface (`ScreeningResponse`, `ScreeningRow`), +1 function `fetchScreening` |
| `frontend/src/App.tsx` | Modified | Extend `activeTab` type, +1 tab button, +1 conditional render block |

### 2.3 Files sẽ được tạo mới

| File | Mô tả |
|------|-------|
| `backend/src/config/screeningConfig.ts` | Constants: thresholds, weights, cap |
| `backend/src/routes/screening.ts` | Route handler: validation + pipeline 8 bước |
| `frontend/src/components/ScreeningTab.tsx` | UI component: PeriodFilter + bảng kết quả |

### 2.4 Files KHÔNG bị ảnh hưởng

- `backend/src/routes/ranking.ts` — không sửa
- `backend/src/routes/valuation.ts` — không sửa
- `backend/src/routes/periods.ts` — không sửa
- `backend/src/db/connection.ts` — không sửa
- `backend/src/db/queries.ts` — không sửa
- `frontend/src/components/BankList.tsx` — không sửa
- `frontend/src/components/TrendChart.tsx` — không sửa
- `frontend/src/components/RankingChart.tsx` — không sửa
- `frontend/src/components/PeriodFilter.tsx` — chỉ reuse, không sửa
- `frontend/src/components/ValuationTab.tsx` — không sửa

### 2.5 DB / Schema

Không có thay đổi DB. Screening route read-only từ:
- `bctc_new` (qua cùng pool với ranking route) — `Year`, `Quarter`, `StockCode`, + các metrics cho RANK
- `paybacktime` (qua cùng pool với valuation route) — `StockCode`, `MOS`, `current_price`, `ti_suat_sinh_loi`

### 2.6 Permissions / Settings / Logs

Không có thay đổi auth, CORS (public route — NFR-3), environment variables, hay logging config.

---

## 3. Changes Detail

### 3.1 Files mới — nội dung tóm tắt

#### `backend/src/config/screeningConfig.ts`
```typescript
export const MUA_THRESHOLD = 65;
export const GIU_THRESHOLD = 40;
export const TI_CAP = 0.5;
export const S_RANK_NEUTRAL = 50;
export const WEIGHT_RANK = 0.5;
export const WEIGHT_VAL = 0.5;
```

#### `backend/src/routes/screening.ts`
- Validation inline (§5.2.1)
- Pipeline 8 bước (§5.2.2): ranking query → valuation query → intersect → S_rank → S_val → Score → Signal → Sort+format
- Response: `{ period, data, computed_at }` (§5.2.3)
- try/catch → 500 `{ error: "internal_error" }`

#### `frontend/src/components/ScreeningTab.tsx`
- UIState: `"loading" | "error" | "empty" | "result"`
- Mount: `fetchPeriods()` → set default → `fetchScreening(year, quarter)`
- Period change: clear bảng cũ → loading → fetch → render
- Bảng: 5 cột, màu nền theo signal
- Footer: text công thức cố định

### 3.2 Files sửa — diff tóm tắt

#### `backend/src/index.ts`
```diff
+import { screeningRouter } from "./routes/screening.js";
 ...
+app.use("/api/screening", screeningRouter);
```

#### `frontend/src/api/client.ts`
```diff
+export interface ScreeningRow { ... }
+export interface ScreeningResponse { period: ...; data: ScreeningRow[]; computed_at: string; }
+export async function fetchScreening(year: number, quarter: number, signal?: AbortSignal): Promise<ScreeningResponse> { ... }
```

#### `frontend/src/App.tsx`
```diff
-const [activeTab, setActiveTab] = useState<"ranking" | "valuation">("ranking");
+const [activeTab, setActiveTab] = useState<"ranking" | "valuation" | "screening">("ranking");
 ...
-{(["ranking", "valuation"] as const).map(...)}
+{(["ranking", "valuation", "screening"] as const).map(...)}
 ...
+{activeTab === "screening" && <ScreeningTab />}
```

---

## 4. Implementation Steps

Mỗi step được thực hiện theo thứ tự. Mỗi step là một đơn vị review độc lập.

### Step 1 — `backend/src/config/screeningConfig.ts` (file mới)

**Phạm vi**: Tạo file constants, không có side effect.

**Làm**:
- Export 6 named constants: `MUA_THRESHOLD`, `GIU_THRESHOLD`, `TI_CAP`, `S_RANK_NEUTRAL`, `WEIGHT_RANK`, `WEIGHT_VAL`
- Không có logic, không import gì

**Verify**: File compile với `tsc --noEmit` (hoặc kiểm tra TypeScript không báo lỗi).

**AC liên quan**: AC-16 (config tập trung), NFR-1

---

### Step 2 — `backend/src/routes/screening.ts` (file mới) — Validation

**Phạm vi**: Chỉ phần validation — route handler trả 400 cho mọi input sai, 200 `{ period, data: [], computed_at }` cho input hợp lệ (pipeline chưa implement).

**Làm**:
- `export const screeningRouter = Router()`
- `screeningRouter.get("/", ...)` với inline validation:
  - Check `yearStr` undefined → `400 { error: "year is required" }`
  - Check `quarterStr` undefined → `400 { error: "quarter is required" }`
  - `Number(yearStr)` không phải integer dương → `400 { error: "year must be a positive integer" }`
  - quarter parsed nằm ngoài `{0,1,2,3,4}` → `400 { error: "quarter must be one of 0,1,2,3,4" }`
- Sau validation: tạm trả `200 { period: { year, quarter }, data: [], computed_at: new Date().toISOString() }`

**Verify**:
```bash
curl "localhost:3001/api/screening" → 400 { error: "year is required" }
curl "localhost:3001/api/screening?year=2025" → 400 { error: "quarter is required" }
curl "localhost:3001/api/screening?year=abc&quarter=0" → 400 { error: ... }
curl "localhost:3001/api/screening?year=2025&quarter=5" → 400 { error: "quarter must be one of 0,1,2,3,4" }
curl "localhost:3001/api/screening?year=2025&quarter=0" → 200 { period, data: [], computed_at }
```

**AC liên quan**: AC-6, AC-7

---

### Step 3 — `backend/src/index.ts` — Đăng ký router

**Phạm vi**: 2 dòng thêm vào file hiện có.

**Làm**:
```typescript
import { screeningRouter } from "./routes/screening.js";
app.use("/api/screening", screeningRouter);
```

**Verify**: Server restart không lỗi. `curl localhost:3001/api/screening?year=2025&quarter=0` trả 200.

**AC liên quan**: AC-5, AC-6

---

### Step 4 — `backend/src/routes/screening.ts` — Pipeline Bước 1+2: DB queries

**Phạm vi**: Thêm 2 DB query vào route handler (sau validation, trước khi tính toán).

**Làm**:
- Query ranking: `SELECT Year, Quarter, StockCode, COALESCE(npl_d,0)+... AS totalDiem FROM (...) WHERE Year=? AND Quarter=?`
  - Tái dùng cùng CTE pattern như `ranking.ts` nhưng thêm `WHERE Year=? AND Quarter=?` bên trong CTE
  - Build `Map<stockCode, number>` từ kết quả
- Query valuation: `SELECT StockCode, MOS, current_price, ti_suat_sinh_loi FROM paybacktime WHERE ti_suat_sinh_loi IS NOT NULL`
  - Build `Map<StockCode, { MOS, current_price, ti_suat_sinh_loi }>` từ kết quả

**Verify**: `curl "localhost:3001/api/screening?year=2025&quarter=0"` với DB có data → response vẫn `data: []` (pipeline chưa xong), nhưng không có 500 error.

**AC liên quan**: AC-8 (filter logic phụ thuộc dữ liệu từ 2 query này)

---

### Step 5 — `backend/src/routes/screening.ts` — Pipeline Bước 3–8: tính toán + response

**Phạm vi**: Thêm phần core logic vào route handler.

**Làm** (theo thứ tự pipeline):

Bước 3 — Intersect:
```typescript
const codes = [...rankMap.keys()].filter(c => valMap.has(c));
```

Bước 4 — S_rank normalization:
```typescript
const totalDiems = codes.map(c => rankMap.get(c)!);
const minD = Math.min(...totalDiems);
const maxD = Math.max(...totalDiems);
const sRank = (d: number) =>
  maxD === minD ? S_RANK_NEUTRAL : (d - minD) / (maxD - minD) * 100;
```

Bước 5 — S_val:
```typescript
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sVal = (ti: number) => (clamp(ti, -TI_CAP, TI_CAP) + TI_CAP) / (2 * TI_CAP) * 100;
```

Bước 6 — Score:
```typescript
const score = (sr: number, sv: number) => WEIGHT_RANK * sr + WEIGHT_VAL * sv;
```

Bước 7 — Signal:
```typescript
const signal = (sc: number): "MUA" | "GIỮ" | "TRÁNH" =>
  sc >= MUA_THRESHOLD ? "MUA" : sc >= GIU_THRESHOLD ? "GIỮ" : "TRÁNH";
```

Bước 8 — Build data array, round, sort:
```typescript
const round2 = (x: number) => Math.round(x * 100) / 100;
const data = codes.map(c => { ... }).sort((a, b) => b.score - a.score || a.stockCode.localeCompare(b.stockCode));
```

Response: `{ period: { year, quarter }, data, computed_at: new Date().toISOString() }`

**Verify** (manual với data thực):
```bash
curl "localhost:3001/api/screening?year=2025&quarter=0"
# Kiểm tra: data có rows, sort đúng score DESC, s_rank/s_val/score làm tròn 2 chữ số
# Kiểm tra boundary: mã với ti_suat_sinh_loi null không xuất hiện
```

Verify boundary AC-9 (nếu DB chỉ có 1 mã cho kỳ test):
```bash
curl "localhost:3001/api/screening?year=<kỳ_chỉ_có_1_mã>"
# s_rank phải = 50.00
```

**AC liên quan**: AC-5, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-15

---

### Step 6 — `frontend/src/api/client.ts` — Types + `fetchScreening`

**Phạm vi**: Append vào file hiện có, không sửa code cũ.

**Làm**:
```typescript
export interface ScreeningRow {
  stockCode: string;
  s_rank: number;
  s_val: number;
  score: number;
  signal: "MUA" | "GIỮ" | "TRÁNH";
  totalDiem: number;
  ti_suat_sinh_loi: number;
  current_price: number;
  MOS: number;
}

export interface ScreeningResponse {
  period: { year: number; quarter: number };
  data: ScreeningRow[];
  computed_at: string;
}

export async function fetchScreening(
  year: number,
  quarter: number,
  signal?: AbortSignal
): Promise<ScreeningResponse> {
  const res = await fetch(
    `${BASE}/api/screening?year=${year}&quarter=${quarter}`,
    { signal }
  );
  if (!res.ok) throw new Error(`/api/screening failed: ${res.status}`);
  return res.json();
}
```

**Verify**: TypeScript không báo lỗi. Có thể gọi `fetchScreening(2025, 0)` từ browser console và nhận đúng type.

**AC liên quan**: AC-4, AC-5

---

### Step 7 — `frontend/src/components/ScreeningTab.tsx` (file mới)

**Phạm vi**: Tạo component mới, không sửa file khác.

**Làm**:

State:
```typescript
type UIState = { kind: "loading" } | { kind: "error" } | { kind: "empty" } | { kind: "result"; rows: ScreeningRow[] };
const [periods, setPeriods] = useState<Period[]>([]);
const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
const [ui, setUi] = useState<UIState>({ kind: "loading" });
```

Mount effect: `fetchPeriods()` → `setPeriods` → `setSelectedPeriod(data[0])` → trigger fetch

Fetch effect (dep: `selectedPeriod`):
- Set `ui = { kind: "loading" }`
- `fetchScreening(year, quarter)` → on success: `data.length === 0 → "empty"` else `"result"`
- on error: `ui = { kind: "error" }`
- Dùng `AbortController` để cancel khi unmount / period change

Render:
- Header `<h2>🎯 Sàng Lọc Cổ Phiếu</h2>`
- `<PeriodFilter periods={periods} selected={selectedPeriod} onChange={handlePeriodChange} />`
- Conditional content:
  - loading: `<p>Đang tính toán...</p>`
  - error: `<p>Lỗi tải dữ liệu, vui lòng thử lại</p>`
  - empty: `<p>Không có dữ liệu cho kỳ này</p>`
  - result: `<ScreeningTable rows={...} />`
- Footer text cố định

Signal colors:
```typescript
const BG: Record<string, string> = { MUA: "#e6f4ea", GIỮ: "#fff8e1", TRÁNH: "#fce8e6" };
```

Columns: `Mã CK | Điểm XH | Điểm Định Giá | Điểm Tổng Hợp | Tín hiệu`

Format: `s_rank`, `s_val`, `score` → `.toFixed(2)`

**Verify**: Xem browser, click tab → bảng render, đổi kỳ → loading state rồi bảng mới.

**AC liên quan**: AC-2, AC-3, AC-4, AC-13, AC-14, AC-15, AC-18

---

### Step 8 — `frontend/src/App.tsx` — Thêm tab thứ 3

**Phạm vi**: 3 thay đổi nhỏ vào file hiện có.

**Làm**:
1. Import `ScreeningTab`
2. `useState<"ranking" | "valuation" | "screening">("ranking")`
3. Tab labels map:
   ```typescript
   const TABS = [
     { id: "ranking",   label: "📊  Xếp Hạng" },
     { id: "valuation", label: "💎  Định Giá" },
     { id: "screening", label: "🎯  Sàng Lọc" },
   ] as const;
   ```
4. Render:
   ```typescript
   {activeTab === "screening" && <ScreeningTab />}
   ```

**Lưu ý**: `PeriodFilter` trong App.tsx hiện dùng `periods` từ App state — không liên quan đến `ScreeningTab` tự quản lý periods của nó.

**Verify**: 3 tab hiển thị đúng thứ tự, mặc định "Xếp Hạng" active, click "Sàng Lọc" → ScreeningTab mount, click "Xếp Hạng" lại → BankList vẫn OK.

**AC liên quan**: AC-1, AC-2, AC-17

---

## 5. Risks (Implementation-level)

| ID | Rủi ro | Giảm thiểu |
|----|--------|-----------|
| IR-1 | `parsePeriodParams` bị refactor để reuse vào screening → sai validation messages | Validation viết inline trong `screening.ts` — không touch `queries.ts` |
| IR-2 | SQL ranking trong screening dùng sai CTE (quên `WHERE Year=? AND Quarter=?`) → trả toàn bộ data | Viết unit test hoặc verify bằng `curl` với kỳ không tồn tại (phải trả `data: []`) |
| IR-3 | `paybacktime` query không filter `ti_suat_sinh_loi IS NOT NULL` → null vào pipeline → NaN score | Filter ở SQL level: `WHERE ti_suat_sinh_loi IS NOT NULL` |
| IR-4 | `Math.min(...[])` khi `codes.length === 0` → `Infinity` → `s_rank` NaN | Guard: `if (codes.length === 0) return { ..., data: [] }` trước khi tính min/max |
| IR-5 | `ScreeningTab` không abort fetch cũ khi đổi kỳ nhanh → race condition | Dùng `AbortController` trong useEffect, abort ở cleanup |
| IR-6 | App.tsx loop tabs: thêm "screening" vào array nhưng quên type → TypeScript không catch | Union type `"ranking" \| "valuation" \| "screening"` phải được update trước |
| IR-7 | Footer text hardcode "65" / "40" lệch với `screeningConfig.ts` | Chấp nhận per spec R-2; ghi chú trong PR checklist |

---

## 6. Rollback

Rollback an toàn vì tất cả thay đổi đều additive:

1. **Revert `backend/src/index.ts`**: xóa 1 import + 1 `app.use` line.
2. **Xóa** `backend/src/config/screeningConfig.ts` và `backend/src/routes/screening.ts`.
3. **Revert `frontend/src/App.tsx`**: restore `activeTab` type cũ + xóa tab "Sàng Lọc" + xóa conditional render.
4. **Revert `frontend/src/api/client.ts`**: xóa 2 interface + 1 function ở cuối file.
5. **Xóa** `frontend/src/components/ScreeningTab.tsx`.

Không có DB migration → rollback DB không cần thiết.

---

## 7. Verification Procedure

### 7.1 TypeScript compile check

```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit
```

Cả hai phải pass 0 errors.

### 7.2 API smoke tests (curl)

```bash
# Validation — AC-6
curl -i "localhost:3001/api/screening"
# → 400 { error: "year is required" }

curl -i "localhost:3001/api/screening?year=2025"
# → 400 { error: "quarter is required" }

# Validation — AC-7
curl -i "localhost:3001/api/screening?year=2025&quarter=5"
# → 400 { error: "quarter must be one of 0,1,2,3,4" }

curl -i "localhost:3001/api/screening?year=abc&quarter=0"
# → 400 { error: ... }

# Success — AC-5
curl -s "localhost:3001/api/screening?year=2025&quarter=0" | jq '{period, computed_at, count: (.data | length)}'
# → { "period": { "year": 2025, "quarter": 0 }, "computed_at": "...", "count": N }

# Empty — AC-15
curl -s "localhost:3001/api/screening?year=2099&quarter=0" | jq '.data | length'
# → 0

# Period echo — AC-5
curl -s "localhost:3001/api/screening?year=2025&quarter=0" | jq '.period'
# → { "year": 2025, "quarter": 0 }
```

### 7.3 Boundary value checks (tính tay)

Lấy 1 row từ response thực, tính lại thủ công:

```
s_rank = (totalDiem - min) / (max - min) * 100  → so sánh với response
s_val  = (clamp(ti, -0.5, 0.5) + 0.5) / 1.0 * 100
score  = 0.5 * s_rank + 0.5 * s_val
```

Kiểm tra AC-10: nếu có mã với `ti_suat_sinh_loi > 0.5` → `s_val` phải = 100.00.

Kiểm tra AC-9: tìm kỳ chỉ có 1 mã giao → `s_rank` phải = 50.00.

Kiểm tra AC-12: tìm row có score ≈ 65 → signal phải = "MUA"; row score = 64.99 → "GIỮ".

### 7.4 UI checks (browser)

```
1. Load trang → mặc định tab "Xếp Hạng" active, BankList hiển thị (AC-1, AC-17)
2. Click "Định Giá" → ValuationTab hiển thị, không crash (AC-17)
3. Click "🎯 Sàng Lọc":
   - Hiển thị loading state "Đang tính toán..." (AC-2)
   - Sau load: bảng xuất hiện với đúng 5 cột (AC-2)
   - Combobox default = kỳ đầu tiên của fetchPeriods() (AC-3)
   - Hàng MUA nền xanh #e6f4ea, GIỮ vàng #fff8e1, TRÁNH đỏ #fce8e6 (AC-14)
4. Đổi kỳ → loading state → bảng mới (AC-4)
5. Switch về "Xếp Hạng" → BankList bình thường, switch lại "Sàng Lọc" → re-mount, re-fetch (AC-17)
6. Kiểm tra sort: row đầu có score cao nhất (AC-13)
```

### 7.5 Regression check — AC-17

Sau khi implement xong:
- Tab "Xếp Hạng": PeriodFilter + BankList + TrendChart + RankingChart hoạt động bình thường
- Tab "Định Giá": ValuationTab + "Thực hiện định giá lại" button hoạt động bình thường

---

## 8. Pre-Implementation Checklist

Các điều cần xác nhận trước khi bắt đầu code:

### 8.1 DB / Data

- [ ] **Bảng `paybacktime` tồn tại và có cột `ti_suat_sinh_loi`**: Chạy `DESCRIBE paybacktime` để xác nhận column name khớp với query trong `valuation.ts`.
- [ ] **Bảng `bctc_new` có data cho kỳ muốn test** (ít nhất 1 kỳ có ≥ 2 mã để test normalization không phải edge case).
- [ ] **Có ít nhất 1 mã xuất hiện trong cả `bctc_new` lẫn `paybacktime`** cho kỳ test — nếu không, mọi test đều trả `data: []`.

### 8.2 Backend

- [ ] **`bctc_new` column name là `StockCode` (capital S, C)** — kiểm tra lại vì ranking query dùng `StockCode`, valuation dùng `StockCode` (paybacktime). Screening join theo string key → case phải nhất quán.
- [x] **`paybacktime.ti_suat_sinh_loi` là DOUBLE/FLOAT, không phải string** — xác nhận bởi user 2026-05-10.
- [ ] **Server có thể restart sau khi thêm import mới** mà không lỗi module resolution (`.js` extension cần thiết trong ESM).

### 8.3 Frontend

- [ ] **`fetchPeriods()` trả `{ data: Period[] }` với `data` là array** — kiểm tra `client.ts`: `fetchPeriods` trả raw `res.json()`, caller phải `.data`. Cần `.data` hay không?
  - Hiện tại `App.tsx` làm: `fetchPeriods().then((res: any) => res.data as Period[])` → `ScreeningTab` cũng phải làm tương tự.
- [ ] **`import.meta.env.VITE_API_BASE_URL` được set hoặc fallback `localhost:3001` đúng** trong môi trường dev.
- [ ] **TypeScript strict mode** — `ScreeningTab` phải handle `selectedPeriod === null` trước khi gọi `fetchScreening`.

### 8.4 Spec

- [ ] **Xác nhận error message chính xác** cho validation 400: spec §5.2.1 dùng ví dụ `"year is required"` và `"quarter must be one of 0,1,2,3,4"` — các message khác (year not integer, year not positive) không được spec hóa rõ, cần tự quyết. Quyết định: dùng `"year must be a positive integer"` cho cả trường hợp non-integer và non-positive.
- [ ] **Footer text**: spec §5.4 dùng `Score ≥ 65 → MUA; 40 ≤ Score < 65 → GIỮ; Score < 40 → TRÁNH` — giá trị này hardcode ở frontend. Khi `screeningConfig.ts` thay đổi, phải sửa cả footer (R-2 accepted).

---

## 9. AC Mapping Table

| AC | Mô tả ngắn | Implementation ở đâu | Step |
|----|-----------|---------------------|------|
| AC-1 | 3 tab đúng thứ tự, mặc định "Xếp Hạng" | `App.tsx`: `TABS` array + `useState("ranking")` | Step 8 |
| AC-2 | Click "Sàng Lọc" → ScreeningTab mount, states đúng | `App.tsx`: conditional render; `ScreeningTab.tsx`: UIState | Step 7, 8 |
| AC-3 | Default kỳ = `periods[0]` từ `fetchPeriods()` | `ScreeningTab.tsx`: mount effect set `selectedPeriod(data[0])` | Step 7 |
| AC-4 | Đổi kỳ → re-fetch đúng params | `ScreeningTab.tsx`: `handlePeriodChange` → setSelectedPeriod → useEffect dep | Step 7 |
| AC-5 | 200 response với đúng shape + period echo | `screening.ts`: response object `{ period, data, computed_at }` | Step 2, 5 |
| AC-6 | Thiếu year/quarter → 400 | `screening.ts`: inline validation | Step 2 |
| AC-7 | quarter=5 → 400 | `screening.ts`: `quarter < 0 \|\| quarter > 4` check | Step 2 |
| AC-8 | Mã không có valuation → không xuất hiện | `screening.ts` Bước 3: intersect `rankMap ∩ valMap` | Step 5 |
| AC-9 | max==min → s_rank = 50.00 | `screening.ts` Bước 4: `maxD === minD ? S_RANK_NEUTRAL : ...` | Step 5 |
| AC-10 | ti vượt cap → clamp đúng | `screening.ts` Bước 5: `clamp(ti, -TI_CAP, TI_CAP)` | Step 5 |
| AC-11 | Score = 0.5*s_rank + 0.5*s_val, round 2 | `screening.ts` Bước 6 + `round2()` ở Bước 8 | Step 5 |
| AC-12 | Signal boundary: >=65 MUA, >=40 GIỮ, <40 TRÁNH | `screening.ts` Bước 7: signal function + import thresholds | Step 5 |
| AC-13 | Sort score DESC, stockCode ASC | `screening.ts` Bước 8: `.sort((a,b) => b.score - a.score \|\| a.stockCode.localeCompare(b.stockCode))` | Step 5 |
| AC-14 | Row coloring: MUA/#e6f4ea, GIỮ/#fff8e1, TRÁNH/#fce8e6 | `ScreeningTab.tsx`: `BG` map + `style={{ backgroundColor: BG[row.signal] }}` | Step 7 |
| AC-15 | Empty data → 200 data:[], UI "Không có dữ liệu" | `screening.ts`: guard khi `codes.length===0`; `ScreeningTab.tsx`: `"empty"` state | Step 5, 7 |
| AC-16 | Đổi MUA_THRESHOLD → behavior thay đổi, không hardcode | `screeningConfig.ts`: `MUA_THRESHOLD = 65`; `screening.ts`: import only | Step 1, 5 |
| AC-17 | Tab "Xếp Hạng" + "Định Giá" không regression | `App.tsx`: không sửa logic 2 tab cũ, chỉ extend | Step 8 |
| AC-18 | DB lỗi → 500 internal_error, UI "Lỗi tải dữ liệu" | `screening.ts`: try/catch `{ error: "internal_error" }`; `ScreeningTab.tsx`: `"error"` state | Step 5, 7 |
