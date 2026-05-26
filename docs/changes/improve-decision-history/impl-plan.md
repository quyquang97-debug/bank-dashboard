# Implementation Plan — Improve Decision History

**Spec**: `docs/changes/improve-decision-history/spec-pack.md` v0.2 FINAL  
**Date**: 2026-05-26  
**Status**: Ready for implementation

---

## 1. Policy

| # | Rule |
|---|------|
| P-1 | **Không làm ngoài spec.** Bất kỳ yêu cầu bổ sung nào trong quá trình impl → tạo Open Issue mới, không tự quyết. |
| P-2 | **1 step = 1 đơn vị review được.** Mỗi step chỉ chạm đúng file và hành vi được liệt kê. Không "dọn" code xung quanh trừ khi spec yêu cầu. |
| P-3 | **Backward compat tuyệt đối.** Column `volume` không DROP. API chấp nhận `volume` từ client cũ. Entry cũ hiển thị "—" cho các field mới. |
| P-4 | **Migration trước code.** DB schema phải được ALTER trước khi deploy backend mới — tránh COLUMN NOT FOUND lúc runtime. |
| P-5 | **Không thay đổi logic AI** ngoài việc thay `volume` → `quantity`/`buy_amount`/`asset_type` trong prompt. |
| P-6 | **i18n bắt buộc trước merge.** Tất cả key mới phải có đủ trong vi/en/ja. |
| P-7 | **`color-scheme: dark` test toàn dashboard.** Sau khi apply phải verify tất cả tab (AC-16). |

---

## 2. Impact Analysis

### 2.1 Files bị ảnh hưởng

#### Backend

| File | Loại thay đổi |
|------|--------------|
| `backend/src/lib/decisionValidation.ts` | Thêm `asset_type`, `quantity`, `buy_amount` vào interface + validation. Bỏ `stop_loss` required khi SAVINGS. |
| `backend/src/routes/decisions.ts` | SELECT/INSERT/UPDATE thêm 3 cột. Thêm `?asset_type=` filter. Thêm endpoint `GET /:id/current-price`. Sửa `POST /:id/reviews` nhận `current_price`. |
| `backend/src/lib/aiService.ts` | `EntryForReview` interface thêm 3 field. `buildReviewPrompt` thay dòng `volume` bằng `asset_type` + `quantity` + `buy_amount`. |
| `backend/src/lib/priceService.ts` | `PriceSnapshot` làm nullable `maxPrice/maxDate/minPrice/minDate/slHit/tpHits`. Thêm `buildNonStockPriceSnapshot`. |

#### Frontend

| File | Loại thay đổi |
|------|--------------|
| `frontend/src/api/client.ts` | `DecisionEntry` thêm 3 field. `fetchDecisions` thêm `asset_type` param. Thêm `fetchCurrentPrice`. `createReview` nhận `current_price`. |
| `frontend/src/components/decisions/DecisionForm.tsx` | Thêm `asset_type` dropdown, `quantity`/`buy_amount` fields, auto-calc logic, ẩn/hiện fields theo `asset_type`, dynamic labels. |
| `frontend/src/components/decisions/DecisionDetail.tsx` | Thay `Tỉ trọng` row, thêm `asset_type` display, sửa `handleEvaluate` → 2-step với inline price panel. |
| `frontend/src/components/decisions/DecisionTimeline.tsx` | Thêm `asset_type` badge column thay `volume`, thêm `asset_type` filter. |
| `frontend/src/locales/vi.json` | Thêm keys từ spec §5.5. |
| `frontend/src/locales/en.json` | Thêm keys từ spec §5.5. |
| `frontend/src/locales/ja.json` | Thêm keys từ spec §5.5. |
| CSS global (xác định file trước impl — xem §4 checklist) | Thêm `:root { color-scheme: dark; }`. |

#### DB

| Object | Thay đổi |
|--------|---------|
| `decision_journal` | ADD COLUMN `asset_type ENUM(...)`, `quantity BIGINT NULL`, `buy_amount BIGINT NULL`. KHÔNG DROP `volume`. |

#### Files KHÔNG thay đổi

- `backend/src/db/connection.ts` — không đổi
- `backend/src/lib/priceService.ts` > `getCurrentPrice`, `getHistoricalPrices` — logic giữ nguyên
- `DecisionSummary.tsx`, `DecisionsTab.tsx` — không đổi
- Tất cả routes ngoài `/decisions` — không đổi

---

## 3. Implementation Steps

> Convention: mỗi step ghi rõ file(s) chạm, hành vi thêm/sửa, và AC liên quan.

---

### STEP 1 — DB Migration

**File**: Tạo `database/migrations/002_improve_decision_history.sql`

```sql
-- Idempotent: chạy nhiều lần không lỗi
ALTER TABLE decision_journal
  ADD COLUMN IF NOT EXISTS asset_type  ENUM('STOCK','GOLD','CRYPTO','SAVINGS') NOT NULL DEFAULT 'STOCK' AFTER ticker,
  ADD COLUMN IF NOT EXISTS quantity    BIGINT NULL COMMENT 'Số lượng đơn vị tài sản',
  ADD COLUMN IF NOT EXISTS buy_amount  BIGINT NULL COMMENT 'Tổng tiền mua, đơn vị VNĐ';
-- Giữ nguyên volume DOUBLE NULL — không DROP
```

**Chạy**: `mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME < database/migrations/002_improve_decision_history.sql`

**AC**: AC-24 (DEFAULT 'STOCK'), AC-26 (GET không lỗi SQL sau migrate).

---

### STEP 2 — Backend: `decisionValidation.ts` — interface + validation

**File**: `backend/src/lib/decisionValidation.ts`

Thay đổi:
1. Thêm `asset_type?: unknown`, `quantity?: unknown`, `buy_amount?: unknown` vào `EntryInput`.
2. Validation `asset_type`: nếu có giá trị → phải thuộc `['STOCK','GOLD','CRYPTO','SAVINGS']`; sai → error `{ field: 'asset_type', code: 'invalid_asset_type' }`.
3. Validation `quantity`: nếu có giá trị → phải là số nguyên không âm (`Number.isInteger(n) && n >= 0`); sai → `{ field: 'quantity', code: 'invalid_quantity' }`.
4. Validation `buy_amount`: nếu có giá trị → phải là số nguyên không âm; sai → `{ field: 'buy_amount', code: 'invalid_buy_amount' }`.
5. **Sửa rule `stop_loss_required_for_buy`**: chỉ áp dụng khi `decision_type === 'BUY'` **VÀ** `asset_type !== 'SAVINGS'`.

**AC**: AC-4, AC-21, AC-22, AC-8 (gián tiếp qua validation).

---

### STEP 3 — Backend: `decisions.ts` — CRUD queries (SELECT/INSERT/UPDATE)

**File**: `backend/src/routes/decisions.ts`

Thay đổi:
1. **`GET /api/decisions`** — thêm `dj.asset_type, dj.quantity, dj.buy_amount` vào SELECT. Thêm filter `asset_type`: nếu `req.query.asset_type` → `asset_type IN (...)` với multi-value split bởi dấu phẩy.
2. **`GET /api/decisions/:id`** — không cần đổi vì dùng `SELECT *`.
3. **`POST /api/decisions`** — destructure thêm `asset_type = 'STOCK', quantity = null, buy_amount = null` từ `req.body`. Thêm vào INSERT columns và VALUES.
4. **`PUT /api/decisions/:id`** — destructure tương tự. Thêm vào UPDATE SET.

**AC**: AC-5, AC-7, AC-21, AC-23, AC-24 (via DEFAULT), AC-26.

---

### STEP 4 — Backend: `aiService.ts` — EntryForReview + prompt

**File**: `backend/src/lib/aiService.ts`

Thay đổi:
1. `EntryForReview` interface: thêm `asset_type: string`, `quantity: number | null`, `buy_amount: number | null`; giữ `volume` (backward compat — không dùng trong prompt mới).
2. `buildReviewPrompt`: thay dòng `- Portfolio weight: ${entry.volume ?? "N/A"}%` bằng:
   ```
   - Asset type: ${entry.asset_type}
   - Quantity: ${entry.quantity != null ? entry.quantity + ' units' : 'N/A'}
   - Buy amount: ${entry.buy_amount != null ? entry.buy_amount + ' VND' : 'N/A'}
   ```
3. Trong `POST /:id/reviews` handler (bước tiếp theo), đảm bảo `entry.asset_type`, `entry.quantity`, `entry.buy_amount` được truyền vào `reviewDecision`.

**AC**: AC-8.

---

### STEP 5 — Backend: `priceService.ts` — nullable snapshot cho non-STOCK

**File**: `backend/src/lib/priceService.ts`

Thay đổi:
1. Cập nhật `PriceSnapshot` interface: `maxPrice: number | null`, `maxDate: string | null`, `minPrice: number | null`, `minDate: string | null`, `slHit: boolean | null`, `tpHits: number[] | null`.
2. Thêm function:
   ```typescript
   export function buildNonStockPriceSnapshot(
     entryPrice: number,
     currentPrice: number
   ): PriceSnapshot {
     const changePct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
     return { currentPrice, changePct, maxPrice: null, maxDate: null, minPrice: null, minDate: null, slHit: null, tpHits: null };
   }
   ```
3. `buildPriceSnapshot` trả về vẫn điền đủ các field non-null (không thay đổi logic).

> Lưu ý: `ReviewCard` trong FE dùng `price_snapshot.currentPrice` và `price_snapshot.changePct` — không bị ảnh hưởng khi các field khác null. Cần verify `slHit` / `tpHits` display ở `buildReviewPrompt` (step 4 dùng `snapshot.slHit`, `snapshot.tpHits`) — cần guard `?? false` / `?? []`.

**AC**: AC-13 (GOLD review lưu đúng changePct).

---

### STEP 6 — Backend: `decisions.ts` — GET `/:id/current-price`

**File**: `backend/src/routes/decisions.ts`

Thêm route (đặt TRƯỚC `get('/:id')` nhưng SAU `get('/summary')`):

```typescript
decisionsRouter.get("/:id/current-price", async (req, res) => {
  const { id } = req.params;
  const [entries] = await pool.execute<any[]>(
    "SELECT asset_type, ticker, entry_price FROM decision_journal WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  if (entries.length === 0) return res.status(404).json({ error: "not_found" });
  const entry = entries[0];
  if (entry.asset_type !== "STOCK") return res.status(400).json({ error: "not_stock" });
  try {
    const currentPrice = await getCurrentPrice(entry.ticker);
    const changePct = entry.entry_price > 0
      ? ((currentPrice - entry.entry_price) / entry.entry_price) * 100
      : 0;
    return res.json({ data: { currentPrice, changePct, fetchedAt: new Date().toISOString() } });
  } catch (err) {
    if (err instanceof PriceFetchError) return res.status(503).json({ error: "price_fetch_failed" });
    throw err;
  }
});
```

**AC**: AC-9 (FE nhận được giá), AC-10 (503 khi Vietstock lỗi).

---

### STEP 7 — Backend: `decisions.ts` — POST `/:id/reviews` — nhận `current_price`

**File**: `backend/src/routes/decisions.ts`

Thay đổi handler `POST /:id/reviews`:
1. Destructure `current_price?: number` từ `req.body`.
2. Đọc `entry.asset_type` (đã có nhờ step 3 thêm vào SELECT `*`).
3. **Nhánh STOCK**:
   - Nếu `current_price` được gửi kèm: dùng làm `currentPrice`, vẫn fetch `history` + `vnindexHistory` để tính `maxPrice`/`minPrice`/`slHit`/`tpHits`.
   - Nếu không gửi: giữ nguyên flow fetch `getCurrentPrice` hiện tại.
4. **Nhánh non-STOCK** (`GOLD`, `CRYPTO`, `SAVINGS`):
   - Nếu `current_price` được gửi: dùng `buildNonStockPriceSnapshot(entry.entry_price, current_price)`.
   - Nếu không gửi: `priceSnapshot = null` (AI review vẫn chạy, thiếu price context).
   - Không gọi `getHistoricalPrices` hoặc `getCurrentPrice` (Vietstock).
5. Truyền `asset_type`, `quantity`, `buy_amount` từ `entry` vào `reviewDecision` call.

**AC**: AC-8, AC-13, AC-14 (backend side).

---

### STEP 8 — Frontend: `client.ts` — types + API functions

**File**: `frontend/src/api/client.ts`

Thay đổi:
1. `DecisionEntry`: thêm `asset_type: 'STOCK' | 'GOLD' | 'CRYPTO' | 'SAVINGS'`, `quantity: number | null`, `buy_amount: number | null`. Giữ `volume: number | null`.
2. `fetchDecisions` params: thêm `asset_type?: string`.
3. Thêm function:
   ```typescript
   export async function fetchCurrentPrice(id: number, signal?: AbortSignal): Promise<{ data: { currentPrice: number; changePct: number; fetchedAt: string } }> {
     const res = await decisionFetch(`/${id}/current-price`, { signal });
     if (!res.ok) {
       const err = await res.json().catch(() => ({ error: "unknown" }));
       const e = new Error(err.error ?? "price_fetch_failed");
       (e as any).status = res.status;
       (e as any).body = err;
       throw e;
     }
     return res.json();
   }
   ```
4. `createReview`: thêm param `currentPrice?: number`, gửi body `{ current_price: currentPrice }` nếu có.

**AC**: AC-9, AC-12, AC-13 (FE side).

---

### STEP 9 — Frontend: `DecisionForm.tsx` — asset_type + quantity + buy_amount

**File**: `frontend/src/components/decisions/DecisionForm.tsx`

Thay đổi:
1. Thêm state: `assetType` (default `'STOCK'`), `quantity` (string), `buyAmount` (string), `buyAmountManual` (boolean flag — user đã override tay chưa).
2. Xóa state `volume`.
3. Thêm dropdown `asset_type` (4 options) đặt TRƯỚC `ticker` trong grid.
4. `ticker` placeholder: dynamic theo `assetType` (STOCK → "VD: VCB", GOLD → "VD: SJC", v.v.).
5. `entry_price` label: dynamic (`t('decisions.form.entry_price_savings')` khi SAVINGS, `t('decisions.form.entry_price')` khi khác).
6. Thay field `volume` bằng `quantity` (hiện khi STOCK/GOLD/CRYPTO, ẩn khi SAVINGS) và `buy_amount` (hiện với tất cả).
7. **Auto-calc `buy_amount`**: `useEffect` deps `[quantity, entryPrice]` → nếu cả 2 hợp lệ > 0 và `buyAmountManual === false` → set `buyAmount = String(Math.round(parseFloat(quantity) * parseFloat(entryPrice)))`. Khi user sửa tay `buyAmount` → set `buyAmountManual = true`. Khi `quantity` hoặc `entryPrice` thay đổi (và `buyAmountManual === true`) → reset `buyAmountManual = false` rồi tính lại.
8. Risk Plan section: ẩn hoàn toàn (không render) khi `assetType === 'SAVINGS'`.
9. `stop_loss` FE validation: skip khi `assetType === 'SAVINGS'`.
10. Submit body: thêm `asset_type: assetType`, `quantity: quantity ? parseInt(quantity) : null`, `buy_amount: buyAmount ? parseInt(buyAmount) : null`. Xóa `volume`.

**AC**: AC-1, AC-2, AC-3, AC-17, AC-18, AC-19, AC-20.

---

### STEP 10 — Frontend: `DecisionDetail.tsx` — hiển thị fields mới + 2-step evaluate

**File**: `frontend/src/components/decisions/DecisionDetail.tsx`

Thay đổi:
1. Import `fetchCurrentPrice` từ `client.ts`.
2. Thêm state cho price panel: `pricePreview: { currentPrice: number; changePct: number } | null`, `pricePreviewState: 'idle' | 'loading' | 'ready' | 'error'`, `manualPrice: string`, `priceError: string | null`.
3. Entry details table:
   - Thêm row `asset_type` (hiển thị translated label).
   - Thay row `Tỉ trọng` bằng: row `Số lượng` (`entry.quantity != null ? entry.quantity : "—"`) và row `Số tiền mua` (`entry.buy_amount != null ? formatVND(entry.buy_amount) : "—"`).
   - `entry_price` label: "Giá vào" cho STOCK/GOLD/CRYPTO, "Số tiền gốc" cho SAVINGS.
4. `handleEvaluate` → tách thành 2 functions:
   - `handleEvaluateClick()`: cho STOCK → set `pricePreviewState = 'loading'`, gọi `fetchCurrentPrice(id)` → set `pricePreview`, `pricePreviewState = 'ready'`. Lỗi → `pricePreviewState = 'error'`, hiển thị message. Cho non-STOCK → `pricePreviewState = 'ready'` ngay (hiện manual input).
   - `handleConfirmEvaluate()`: lấy `currentPrice` từ `pricePreview?.currentPrice` (STOCK) hoặc `parseFloat(manualPrice)` (non-STOCK) → gọi `createReview(id, lang, signal, currentPrice)`.
5. Inline panel (render khi `pricePreviewState !== 'idle'`):
   - Loading: spinner.
   - Error: message lỗi + nút retry.
   - Ready STOCK: hiển thị `Giá hiện tại: X đ | Thay đổi: ±Y%` + nút "Xác nhận đánh giá" + "Hủy".
   - Ready non-STOCK: input manual price (required, ≥ 0) + nút "Xác nhận đánh giá" (disabled khi input rỗng) + "Hủy".
6. "Hủy": reset `pricePreviewState = 'idle'`, `pricePreview = null`, `manualPrice = ''`.

**AC**: AC-9, AC-10, AC-11, AC-12, AC-13, AC-14.

---

### STEP 11 — Frontend: `DecisionTimeline.tsx` — badge + filter

**File**: `frontend/src/components/decisions/DecisionTimeline.tsx`

Thay đổi:
1. Thêm state `filterAssetTypes: string[]`.
2. Filter bar: thêm buttons cho 4 asset types (cùng style với decision type buttons), gọi `toggleAssetType`.
3. Truyền `asset_type: filterAssetTypes.length ? filterAssetTypes.join(',') : undefined` vào `fetchDecisions`.
4. Table header: thay cột `volume` bằng cột `asset_type`.
5. Table row: hiển thị badge `asset_type` thay vì `entry.volume`.

**AC**: AC-23, AC-25.

---

### STEP 12 — i18n: vi/en/ja locale files

**Files**: `frontend/src/locales/vi.json`, `en.json`, `ja.json`

Thêm tất cả keys từ spec §5.5 vào `decisions` object của mỗi file.

**vi.json additions (under `decisions`):**
```json
"form": {
  ...existing...,
  "asset_type": "Loại tài sản",
  "quantity": "Số lượng",
  "buy_amount": "Số tiền mua (VNĐ)",
  "entry_price_savings": "Số tiền gốc (VNĐ)"
},
"asset_type": {
  "stock": "Cổ phiếu",
  "gold": "Vàng",
  "crypto": "Tiền ảo",
  "savings": "Gửi tiết kiệm"
},
"review": {
  ...existing...,
  "current_price_preview": "Giá hiện tại",
  "change_pct_preview": "Thay đổi",
  "manual_price_label": "Giá / giá trị hiện tại (VNĐ)",
  "confirm_evaluate": "Xác nhận đánh giá",
  "btn_cancel_evaluate": "Hủy"
},
"error": {
  ...existing...,
  "invalid_asset_type": "Loại tài sản không hợp lệ",
  "invalid_quantity": "Số lượng phải là số nguyên không âm",
  "invalid_buy_amount": "Số tiền mua phải là số nguyên không âm",
  "manual_price_required": "Vui lòng nhập giá hiện tại trước khi đánh giá"
}
```

Tương tự en/ja với translations phù hợp.

**AC**: AC-27.

---

### STEP 13 — CSS: `color-scheme: dark`

**File**: Xác định file CSS global (xem checklist §4 — cần tìm file trước khi impl).

Thêm vào `:root`:
```css
:root {
  color-scheme: dark;
}
```

Verify SVG icons custom: đảm bảo `fill` / `stroke` dùng `currentColor`.

**AC**: AC-15, AC-16.

---

## 4. Checklist trước khi bắt đầu

> Xác nhận từng item dưới đây trước khi chạy bất kỳ step nào.

| # | Item | Cần xác nhận |
|---|------|-------------|
| C-1 | DB backup đã chạy trước STEP 1 | `mysqldump finance decision_journal > finance_backup_$(date +%Y%m%d).sql` |
| C-2 | Columns chưa tồn tại (tránh lỗi migration lần 2) | `SHOW COLUMNS FROM decision_journal;` — kiểm tra `asset_type`, `quantity`, `buy_amount` chưa có |
| C-3 | `VIETSTOCK_COOKIE` và `VIETSTOCK_TOKEN` đang còn valid | Test `GET /api/decisions/:id/current-price` với 1 STOCK entry thực tế |
| C-4 | File CSS global của frontend | Tìm file import `:root` styles — có thể là `frontend/src/index.css` hoặc `App.css` (cần xác định trước STEP 13) |
| C-5 | Route ordering an toàn | `GET /:id/current-price` sẽ đặt trước `GET /:id` — verify Express không bị ambiguity |
| C-6 | `decision_review.price_snapshot` DB column type | Là `TEXT` / `JSON` — xác nhận nullable fields trong `PriceSnapshot` không break deserialization ở `ReviewCard` |
| C-7 | `DecisionEntry` type trên FE dùng ở đâu khác | Tìm `DecisionEntry` usages ngoài 3 component đã đọc — nếu có thêm component sử dụng field `volume` cần update |

---

## 5. Risks & Mitigations

| ID | Risk | Mức độ | Mitigation |
|----|------|--------|-----------|
| R-1 | `ALTER TABLE` lock production | Thấp (single-user) | Backup trước (C-1); chạy ngoài giờ |
| R-2 | `color-scheme: dark` vỡ tab khác | Trung bình | Test toàn dashboard sau STEP 13 (AC-16) |
| R-3 | `buy_amount` reset khi user sửa `entry_price` sau override | Trung bình | STEP 9: flag `buyAmountManual` reset khi `quantity`/`entry_price` thay đổi — spec AC-3 |
| R-4 | SAVINGS `entry_price` label không đổi ở Detail view | Thấp | STEP 10: label phải dynamic theo `entry.asset_type` |
| R-5 | i18n key thiếu trong 1 locale | Thấp | STEP 12 làm cùng lúc 3 file; verify bằng key diff sau đó |
| R-6 | Vietstock fetch timeout khi user bấm "Đánh giá" | Thấp | STEP 10: spinner + error state + retry |
| R-7 | `PriceSnapshot` nullable fields break `ReviewCard` display | Thấp | STEP 5 + 10: `slHit ?? false`, `tpHits ?? []` khi hiển thị; `maxPrice ?? null` sẽ không hiển thị là vấn đề vì ReviewCard chỉ dùng `currentPrice` và `changePct` |

---

## 6. Rollback

| Step | Rollback action |
|------|----------------|
| STEP 1 | `ALTER TABLE decision_journal DROP COLUMN asset_type, DROP COLUMN quantity, DROP COLUMN buy_amount;` — dữ liệu `volume` không bị mất |
| STEP 2–7 | `git revert` commit backend. DB column vẫn còn nhưng không được dùng — safe. |
| STEP 8–13 | `git revert` commit frontend. Backend API vẫn nhận `volume` từ old FE. |

---

## 7. Verification Procedure

Sau khi deploy toàn bộ steps, chạy theo thứ tự:

```
1. GET /api/decisions → response chứa asset_type, quantity, buy_amount cho entries mới
2. Entry cũ: asset_type = "STOCK", quantity = null, buy_amount = null ✓
3. POST /api/decisions { asset_type: "SAVINGS", ticker: "BIDV-12T", ... risk_plan: null } → 201 ✓
4. POST /api/decisions { asset_type: "STOCK", quantity: 1000, entry_price: 92000 } → buy_amount auto-calc trên FE = 92,000,000 ✓
5. POST /api/decisions { asset_type: "INVALID" } → 400 { error: "invalid_asset_type" } ✓
6. POST /api/decisions { quantity: 1.5 } → 400 { error: "invalid_quantity" } ✓
7. GET /api/decisions?asset_type=GOLD → chỉ GOLD entries ✓
8. GET /api/decisions/:stockId/current-price → 200 { currentPrice, changePct } ✓
9. GET /api/decisions/:goldId/current-price → 400 { error: "not_stock" } ✓
10. POST /api/decisions/:goldId/reviews body: { current_price: 8500000 } → review với price_snapshot.currentPrice = 8500000 ✓
11. Chrome: icon lịch trong datetime-local field → màu trắng ✓
12. Kiểm tra tất cả tab: Bank List, Trend, Ranking, Screening, Valuation không vỡ layout ✓
```

---

## 8. AC Mapping Table

| AC | Step thực hiện | File |
|----|---------------|------|
| AC-1 | STEP 9 | DecisionForm.tsx |
| AC-2 | STEP 9 | DecisionForm.tsx |
| AC-3 | STEP 9 | DecisionForm.tsx (buyAmountManual flag) |
| AC-4 | STEP 2 | decisionValidation.ts |
| AC-5 | STEP 3 | decisions.ts INSERT + SELECT |
| AC-6 | STEP 3 + 10 + 11 | decisions.ts SELECT, DecisionDetail.tsx, DecisionTimeline.tsx |
| AC-7 | STEP 3 | decisions.ts PUT |
| AC-8 | STEP 4 | aiService.ts buildReviewPrompt |
| AC-9 | STEP 6 + 8 + 10 | decisions.ts GET /:id/current-price, client.ts, DecisionDetail.tsx |
| AC-10 | STEP 6 + 10 | decisions.ts 503, DecisionDetail.tsx error state |
| AC-11 | STEP 10 | DecisionDetail.tsx (Hủy handler) |
| AC-12 | STEP 10 | DecisionDetail.tsx (non-STOCK manual input) |
| AC-13 | STEP 5 + 7 + 10 | priceService.ts, decisions.ts reviews, DecisionDetail.tsx |
| AC-14 | STEP 10 | DecisionDetail.tsx (disabled until input ≥ 0) |
| AC-15 | STEP 13 | CSS global |
| AC-16 | STEP 13 + manual test | CSS global — regression all tabs |
| AC-17 | STEP 9 | DecisionForm.tsx |
| AC-18 | STEP 9 | DecisionForm.tsx (ẩn quantity + risk plan) |
| AC-19 | STEP 9 | DecisionForm.tsx |
| AC-20 | STEP 9 | DecisionForm.tsx |
| AC-21 | STEP 2 + 3 | decisionValidation.ts + decisions.ts |
| AC-22 | STEP 2 | decisionValidation.ts |
| AC-23 | STEP 3 + 11 | decisions.ts GET filter, DecisionTimeline.tsx |
| AC-24 | STEP 1 | DB migration DEFAULT 'STOCK' |
| AC-25 | STEP 11 | DecisionTimeline.tsx |
| AC-26 | STEP 1 | DB migration (idempotent, không drop data) |
| AC-27 | STEP 12 | vi/en/ja locale files |
