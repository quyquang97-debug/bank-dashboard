# Spec Pack — Improve Decision History

**Ticket**: Yêu cầu cải thiện màn hình Lịch sử Quyết định  
**Version**: 0.2 (Phase 1 — All OIs Resolved)  
**Date**: 2026-05-26  
**Status**: FINAL — tất cả Open Issues đã đóng, sẵn sàng chuyển sang Phase 2

---

## 1. Background / Purpose

Màn hình "Quyết định của tôi" đã triển khai xong (ticket `descision-history-and-evaluation`). Sau khi sử dụng thực tế, owner phát hiện 4 vấn đề cần cải thiện trước khi bắt đầu ghi nhật ký nghiêm túc:

1. Trường **tỉ trọng** (% danh mục) không đủ thông tin thực tế — cần biết **số lượng đơn vị** và **số tiền** đã mua.
2. Khi đánh giá quyết định cũ, không nhìn thấy **giá hiện tại** trước khi bấm nút → khó biết đang đánh giá ở ngưỡng giá nào.
3. **Icon trong ô nhập liệu** (ví dụ: lịch trong `datetime-local`) hiển thị màu đen, trông không hài hòa với giao diện tối.
4. **Loại tài sản** bị giới hạn ở cổ phiếu — muốn ghi nhật ký cho Vàng, Crypto, Gửi tiết kiệm.

---

## 2. Scope

### 2.1 Làm gì (In-scope)

- **[Change A]** Thay trường `volume` (tỉ trọng %) bằng hai trường mới: `quantity` (số lượng đơn vị tài sản, số nguyên ≥ 0) và `buy_amount` (số tiền mua, VNĐ, số nguyên ≥ 0). `buy_amount` được auto-calculate từ `quantity × entry_price` nhưng vẫn editable.
- **[Change B]** Khi user bấm "Đánh giá" lần đầu, hiển thị inline panel giá hiện tại (fetch từ Vietstock với STOCK; user nhập tay với GOLD/CRYPTO/SAVINGS) trước khi trigger AI.
- **[Change C]** Đổi màu tất cả icon bên trong ô nhập liệu từ màu đen sang màu trắng.
- **[Change D]** Thêm trường `asset_type` (Cổ phiếu / Vàng / Tiền ảo / Gửi tiết kiệm); ẩn Risk Plan khi chọn Gửi tiết kiệm.
- i18n cho tất cả label, placeholder, message mới trong 3 ngôn ngữ (vi/en/ja).

### 2.2 Không làm (Out-of-scope)

- Thay đổi logic AI review (prompt template, model, provider) ngoài việc thay `volume` bằng `quantity`/`buy_amount` + thêm `asset_type`.
- Tích hợp API giá ngoài cho GOLD/CRYPTO — user nhập tay.
- Migration tự động dữ liệu `volume` cũ sang `quantity`/`buy_amount` — entry cũ hiển thị "—".
- Tính toán P&L theo danh mục.
- Responsive mobile.
- Thay đổi các tab khác (Bank List / Trend / Ranking / Screening / Valuation).

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| **`quantity`** | Số lượng đơn vị tài sản (cổ phiếu: số cổ phiếu; vàng: số chỉ/lượng; crypto: số coin; savings: bỏ trống hoặc không dùng). Số nguyên không âm (BIGINT). |
| **`buy_amount`** | Tổng số tiền bỏ ra, đơn vị VNĐ. BIGINT không âm. Auto-calculate = `quantity × entry_price`; user có thể override. Với SAVINGS: đây là số tiền gốc gửi. |
| **`asset_type`** | Loại tài sản: `STOCK` / `GOLD` / `CRYPTO` / `SAVINGS`. |
| **`entry_price`** | Với STOCK/GOLD/CRYPTO: giá mua mỗi đơn vị (VNĐ). Với SAVINGS: số tiền gốc gửi (VNĐ) — trường `quantity` không có nghĩa rõ ràng với SAVINGS và được ẩn. |
| **Current price (inline)** | Giá thị trường tại thời điểm user bấm "Đánh giá" lần đầu — hiển thị read-only ngay trong View 3 trước bước xác nhận. Với non-STOCK: user nhập tay. |
| **`volume` (deprecated)** | Trường cũ = % danh mục đầu tư. Column giữ nguyên trong DB (không drop); không hiển thị trên form mới. Entries cũ hiển thị "—" cho `quantity`/`buy_amount`. |

---

## 4. As-Is / To-Be

### 4.1 As-Is

| Thành phần | Trạng thái hiện tại |
|-----------|-------------------|
| DB column | `volume DOUBLE NULL` — lưu % danh mục |
| Form field | Label "Tỉ trọng danh mục (%)", input number 0–100 |
| AI prompt context | `volume` gửi vào prompt là % danh mục |
| `asset_type` | Không có — ngầm hiểu là cổ phiếu |
| Icon trong input | Màu đen (browser default), không hài hòa với dark theme |
| Price display trước review | Không có |

### 4.2 To-Be

| Thành phần | Trạng thái mong muốn |
|-----------|-------------------|
| DB columns | Thêm `quantity BIGINT NULL`, `buy_amount BIGINT NULL`, `asset_type ENUM(...)`. Giữ `volume` (không drop). |
| Form fields | Hiển thị "Số lượng" (quantity) + "Số tiền mua (VNĐ)" (buy_amount, auto-calculated + editable). Ẩn `volume`. Với SAVINGS: ẩn `quantity`, label `entry_price` → "Số tiền gốc (VNĐ)". |
| `asset_type` | Dropdown "Loại tài sản" trước `ticker`. Risk Plan ẩn khi SAVINGS. |
| Icon trong input | Màu trắng (`color-scheme: dark`). |
| Price display trước review | Inline panel xuất hiện sau khi bấm "Đánh giá" lần đầu: STOCK → auto-fetch Vietstock; non-STOCK → user nhập tay `current_price` vào input. Sau khi điền / fetch xong → hiện nút "Xác nhận đánh giá". |
| AI prompt context | Thay `volume` bằng `quantity` + `buy_amount`; thêm `asset_type`. |

---

## 5. Detailed Specification

### 5.1 Change A — Thay trường `volume` bằng `quantity` + `buy_amount`

#### 5.1.1 DB Schema

```sql
ALTER TABLE decision_journal
  ADD COLUMN asset_type  ENUM('STOCK','GOLD','CRYPTO','SAVINGS') NOT NULL DEFAULT 'STOCK' AFTER ticker,
  ADD COLUMN quantity    BIGINT NULL COMMENT 'Số lượng đơn vị tài sản',
  ADD COLUMN buy_amount  BIGINT NULL COMMENT 'Tổng tiền mua, đơn vị VNĐ';
-- Giữ nguyên volume DOUBLE NULL — không DROP
```

#### 5.1.2 Form — trường `quantity` và `buy_amount`

| Field | Label (vi) | Type | Required | Validation | Hiển thị với |
|-------|-----------|------|----------|-----------|-------------|
| `quantity` | Số lượng | integer ≥ 0 | Không | Phải là số nguyên; từ chối số thập phân | STOCK, GOLD, CRYPTO |
| `buy_amount` | Số tiền mua (VNĐ) | integer ≥ 0 | Không | Số nguyên | STOCK, GOLD, CRYPTO, SAVINGS |

**Auto-calculate `buy_amount`:**

- Trigger: mỗi khi `quantity` hoặc `entry_price` thay đổi (onChange).
- Công thức: `buy_amount = Math.round(quantity × entry_price)`.
- Điều kiện: cả `quantity` và `entry_price` đều là số hợp lệ > 0.
- User vẫn có thể ghi đè `buy_amount` bằng tay; nếu user sửa tay → không tự tính lại nữa cho đến khi user thay đổi `quantity` hoặc `entry_price` lần tiếp theo.
- Với SAVINGS: `quantity` bị ẩn; `entry_price` đổi label thành "Số tiền gốc (VNĐ)" — không auto-calculate `buy_amount` (2 trường trùng nhau).

#### 5.1.3 API thay đổi

- `POST /api/decisions` và `PUT /api/decisions/:id`: accept thêm `quantity: number | null`, `buy_amount: number | null`, `asset_type: string`.
- Response tất cả GET: trả thêm `quantity`, `buy_amount`, `asset_type`.
- `volume` vẫn được nhận (backward compat) và lưu vào DB nếu client gửi; không validated nghiêm ngặt.

#### 5.1.4 AI prompt context

Thay dòng `volume` bằng:
```
Loại tài sản: {asset_type}
Số lượng mua: {quantity} đơn vị  (bỏ qua nếu null)
Số tiền mua: {buy_amount} VNĐ   (bỏ qua nếu null)
```

---

### 5.2 Change B — Inline current price trước khi đánh giá

#### 5.2.1 UX Flow

**Bước 1 — User bấm "Đánh giá"** (nút hiện có, chỉ enable ≥ 24h):
- Nút "Đánh giá" biến thành trạng thái loading.
- **STOCK**: Backend fetch giá Vietstock → trả về `{ currentPrice, changePct }` → hiển thị inline panel ngay dưới nút:
  ```
  Giá hiện tại: 105,000 đ  |  Thay đổi: +14.1%
  [Xác nhận đánh giá]  [Hủy]
  ```
- **GOLD / CRYPTO / SAVINGS**: Hiển thị inline input:
  ```
  Giá / giá trị hiện tại (VNĐ): [___________]
  [Xác nhận đánh giá]  [Hủy]
  ```
  User nhập số → bấm "Xác nhận đánh giá". Trường này bắt buộc (≥ 0) trước khi Xác nhận được enable.

**Bước 2 — User bấm "Xác nhận đánh giá"**:
- Gửi `current_price` (từ fetch hoặc user nhập) lên `POST /api/decisions/:id/reviews?lang=...` cùng body.
- Flow AI review tiếp tục như cũ.

**Bước 2 — User bấm "Hủy"**:
- Ẩn inline panel; không trigger AI; không có review mới.

#### 5.2.2 Backend thay đổi

- `POST /api/decisions/:id/reviews` nhận thêm body field `current_price: number` (optional).
  - Với STOCK: nếu `current_price` không gửi → backend tự fetch (fallback).
  - Với non-STOCK: nếu `current_price` gửi kèm → dùng làm `price_snapshot.currentPrice`; `changePct` tính từ `current_price / entry_price - 1`; các field `max`, `min`, `sl_hit`, `tp_hits` = null.
  - Nếu non-STOCK mà không gửi `current_price` → `price_snapshot = null` (AI review vẫn chạy, chỉ thiếu price context).

- Không cần endpoint mới `GET /api/decisions/:id/current-price` — STOCK fetch xảy ra tại bước 1 phía client gọi BE endpoint review với `step=price_preview` **hoặc** BE tự fetch khi nhận POST review. Cách đơn giản hơn: **thêm endpoint nhẹ** `GET /api/decisions/:id/current-price` chỉ trả giá, không trigger AI:

  | Method | Path | Mô tả |
  |--------|------|-------|
  | GET | `/api/decisions/:id/current-price` | Fetch giá hiện tại từ Vietstock cho STOCK entry. Trả `{ data: { currentPrice, changePct, fetchedAt } }`. 400 nếu `asset_type ≠ STOCK`. 503 nếu Vietstock lỗi. |

---

### 5.3 Change C — Icon color trong ô nhập liệu

Áp dụng `color-scheme: dark` globally hoặc trên root container của dashboard:

```css
/* Global — áp vào :root hoặc body */
:root {
  color-scheme: dark;
}
```

Với icon SVG custom bên trong wrapper input: đảm bảo `fill` hoặc `stroke` dùng `currentColor` (inherit từ text color = white).

**Phạm vi**: tất cả `<input>`, `<select>`, `<textarea>` trong toàn bộ ứng dụng (không chỉ tab Decisions). Test regression các tab khác sau khi apply (AC-13).

---

### 5.4 Change D — Asset type

#### 5.4.1 Form — dropdown `asset_type`

Đặt trước field `ticker`, width full hoặc ngang với `ticker` (cùng hàng grid):

| Giá trị | Label (vi) | Label (en) | Label (ja) |
|---------|-----------|-----------|-----------|
| `STOCK` | Cổ phiếu | Stock | 株式 |
| `GOLD` | Vàng | Gold | 金 |
| `CRYPTO` | Tiền ảo | Crypto | 仮想通貨 |
| `SAVINGS` | Gửi tiết kiệm | Savings | 預金 |

**Hành vi theo `asset_type`:**

| Field / Section | STOCK | GOLD | CRYPTO | SAVINGS |
|----------------|-------|------|--------|---------|
| `ticker` placeholder | "VD: VCB" | "VD: SJC" | "VD: BTC" | "VD: BIDV-12T" |
| `entry_price` label | "Giá vào lệnh (VNĐ)" | "Giá mua (VNĐ/đơn vị)" | "Giá mua (VNĐ/coin)" | "Số tiền gốc (VNĐ)" |
| `quantity` field | Hiện | Hiện | Hiện | **Ẩn** |
| `buy_amount` field | Hiện (auto-calc) | Hiện (auto-calc) | Hiện (auto-calc) | Hiện (không auto-calc — = entry_price) |
| Risk Plan section | Hiện | Hiện | Hiện | **Ẩn** |
| Price preview (Change B) | Auto-fetch Vietstock | User nhập tay | User nhập tay | User nhập tay |

#### 5.4.2 Timeline View (View 1)

- Thêm badge `asset_type` vào mỗi hàng; hiển thị tất cả (kể cả STOCK) để nhất quán.
- Thêm filter `?asset_type=` vào query params (multi-value: `?asset_type=STOCK,GOLD`).

#### 5.4.3 Validation

- `asset_type` phải thuộc enum; nếu sai → 400 `{ error: "invalid_asset_type" }`.
- Với `SAVINGS`, backend **không validate** `risk_plan` (chấp nhận cả null và object — user không điền vì form ẩn, nhưng nếu client gửi thì cũng không lỗi).
- Default `STOCK` nếu không truyền (backward compat cho client cũ).

---

### 5.5 i18n Keys mới

```json
{
  "decisions": {
    "form": {
      "asset_type":   "Loại tài sản",
      "quantity":     "Số lượng",
      "buy_amount":   "Số tiền mua (VNĐ)",
      "entry_price_savings": "Số tiền gốc (VNĐ)"
    },
    "asset_type": {
      "stock":   "Cổ phiếu",
      "gold":    "Vàng",
      "crypto":  "Tiền ảo",
      "savings": "Gửi tiết kiệm"
    },
    "review": {
      "current_price_preview":  "Giá hiện tại",
      "change_pct_preview":     "Thay đổi",
      "manual_price_label":     "Giá / giá trị hiện tại (VNĐ)",
      "confirm_evaluate":       "Xác nhận đánh giá",
      "btn_cancel_evaluate":    "Hủy"
    },
    "error": {
      "invalid_asset_type":  "Loại tài sản không hợp lệ",
      "invalid_quantity":    "Số lượng phải là số nguyên không âm",
      "invalid_buy_amount":  "Số tiền mua phải là số nguyên không âm",
      "manual_price_required": "Vui lòng nhập giá hiện tại trước khi đánh giá"
    }
  }
}
```

---

## 6. Non-Functional Requirements

| # | Hạng mục | Yêu cầu |
|---|----------|--------|
| NFR-1 | **Backward compat** | API nhận `volume` từ client cũ mà không lỗi. Entries cũ hiển thị đúng. Column `volume` không bị drop. |
| NFR-2 | **Migration an toàn** | `ALTER TABLE` idempotent; không xóa data cũ. Chạy backup trước. |
| NFR-3 | **Latency** | `GET /api/decisions/:id/current-price`: P95 < 5s (phụ thuộc Vietstock). FE hiển thị spinner trong khi chờ. |
| NFR-4 | **UI consistency** | `color-scheme: dark` không làm vỡ layout bất kỳ tab nào. |
| NFR-5 | **i18n completeness** | Tất cả key mới có trong cả 3 file locale (vi/en/ja) trước khi deploy. |
| NFR-6 | **Asset type default** | `DEFAULT 'STOCK'` ở DB level — entries cũ không cần migration. |
| NFR-7 | **AI cost** | Không thay đổi: single-user, manual trigger, < 10 USD/tháng. |

---

## 7. Acceptance Criteria (AC)

### Change A — quantity + buy_amount

- **AC-1**. Khi user mở form thêm quyết định, thấy field "Số lượng" và "Số tiền mua (VNĐ)" thay cho "Tỉ trọng danh mục (%)".
- **AC-2**. Khi user nhập `quantity = 1000` và `entry_price = 92000`, field `buy_amount` tự động hiển thị `92000000`; user có thể sửa trực tiếp giá trị đó.
- **AC-3**. Khi `quantity` hoặc `entry_price` thay đổi sau khi user đã sửa tay `buy_amount`, `buy_amount` được tính lại và ghi đè.
- **AC-4**. Khi user submit với `quantity = 1.5` (số thập phân), API trả 400 `{ error: "invalid_quantity" }`.
- **AC-5**. Khi user submit với `quantity = 1000` (số nguyên hợp lệ), entry được lưu; `GET /api/decisions/:id` trả về `quantity: 1000`.
- **AC-6**. Entry cũ (có `volume`, không có `quantity`/`buy_amount`) hiển thị đúng trong View 1 và View 3; các field mới hiển thị "—"; không crash.
- **AC-7**. Khi sửa entry cũ (không có `quantity`), user điền `quantity` và lưu; GET sau đó trả `quantity` mới, `volume` cũ vẫn còn trong DB.
- **AC-8**. AI review prompt gửi lên chứa `asset_type`, `quantity`, `buy_amount`; không có dòng `volume`.

### Change B — Current price inline

- **AC-9**. Khi user bấm "Đánh giá" với STOCK entry (≥24h), UI fetch giá và hiển thị inline panel "Giá hiện tại: X đ | Thay đổi: ±Y%" cùng 2 nút "Xác nhận đánh giá" / "Hủy" — tất cả ngay trong View 3, không popup.
- **AC-10**. Khi Vietstock API lỗi tại bước fetch giá, UI hiển thị message lỗi trong panel; không trigger AI; không có review mới.
- **AC-11**. Khi user bấm "Hủy" sau khi thấy giá preview, panel đóng lại; không có review mới; nút "Đánh giá" trở lại enabled.
- **AC-12**. Khi user bấm "Đánh giá" với GOLD/CRYPTO/SAVINGS entry (≥24h), UI hiển thị inline input "Giá / giá trị hiện tại (VNĐ)" và nút "Xác nhận đánh giá" bị disable cho đến khi user nhập số ≥ 0.
- **AC-13**. Khi user nhập `current_price` hợp lệ và bấm "Xác nhận đánh giá" với GOLD entry, review được lưu với `price_snapshot.currentPrice` bằng giá user nhập; `changePct` tính từ `current_price / entry_price - 1`.
- **AC-14**. Khi user bấm "Xác nhận đánh giá" với SAVINGS mà không có giá (user không nhập), nút không enable được — `buy_amount` (số tiền gốc) không được dùng thay thế tự động.

### Change C — Icon color

- **AC-15**. Trong Chrome, icon lịch bên trong field `datetime-local` hiển thị màu trắng (không phải đen).
- **AC-16**. Sau khi áp `color-scheme: dark`, các tab Bank List, Trend, Ranking, Screening, Valuation không có thay đổi layout hoặc màu nội dung ngoài icon trong input.

### Change D — Asset type

- **AC-17**. Form thêm/sửa hiển thị dropdown "Loại tài sản" với 4 option; default là Cổ phiếu.
- **AC-18**. Khi chọn "Gửi tiết kiệm": field "Số lượng" bị ẩn; section Risk Plan bị ẩn; label `entry_price` đổi thành "Số tiền gốc (VNĐ)".
- **AC-19**. Khi chọn "Cổ phiếu" / "Vàng" / "Tiền ảo": field "Số lượng" và Risk Plan hiển thị bình thường.
- **AC-20**. Placeholder của `ticker` thay đổi theo `asset_type` (STOCK: "VD: VCB"; GOLD: "VD: SJC"; CRYPTO: "VD: BTC"; SAVINGS: "VD: BIDV-12T").
- **AC-21**. Khi user submit với `asset_type = "SAVINGS"`, API chấp nhận; GET trả `asset_type: "SAVINGS"`.
- **AC-22**. Khi user submit với `asset_type = "INVALID"`, API trả 400 `{ error: "invalid_asset_type" }`.
- **AC-23**. GET `/api/decisions?asset_type=GOLD` chỉ trả entry có `asset_type = "GOLD"`.
- **AC-24**. Entry cũ (không có `asset_type` trong DB trước migration) được đọc ra với `asset_type: "STOCK"` nhờ DEFAULT.
- **AC-25**. Timeline View (View 1) hiển thị badge `asset_type` cho mỗi hàng.

### Non-Functional

- **AC-26**. Sau `ALTER TABLE`, GET `/api/decisions` trả về cả entry cũ và mới mà không có lỗi SQL.
- **AC-27**. Tất cả key i18n mới có trong cả 3 file (vi/en/ja); CI check so sánh keys không báo lỗi.

---

## 8. Examples

### 8.1 Normal cases

**N-1. Thêm quyết định mua cổ phiếu với quantity + buy_amount auto-calculate**
- Input form: `asset_type = STOCK`, `ticker = VCB`, `decision_type = BUY`, `quantity = 1000`, `entry_price = 92000`
- Expected: `buy_amount` tự hiển thị `92,000,000`; user submit → HTTP 201; GET trả `{ asset_type: "STOCK", quantity: 1000, buy_amount: 92000000 }`.

**N-2. Thêm quyết định gửi tiết kiệm**
- Input form: `asset_type = SAVINGS`, `ticker = BIDV-12T`, `decision_type = BUY`, `entry_price = 100000000` (label hiển thị "Số tiền gốc"), `reason = "Lãi suất BIDV 12 tháng 6.8%/năm, ổn định hơn cổ phiếu trong bối cảnh thị trường biến động"`
- Expected: HTTP 201; Risk Plan không gửi (field ẩn); `quantity = null`; GET trả `asset_type: "SAVINGS"`.

**N-3. Đánh giá STOCK — xem giá inline trước khi xác nhận**
- State: entry VCB trên, 60 ngày sau.
- Action: bấm "Đánh giá" → BE fetch Vietstock → FE hiển thị "Giá hiện tại: 105,000 đ | Thay đổi: +14.1%" → user bấm "Xác nhận đánh giá".
- Expected: review mới lưu với `price_snapshot.currentPrice = 105000`, `changePct ≈ 14.1`.

**N-4. Đánh giá GOLD — user nhập tay giá**
- State: entry vàng SJC, 30 ngày sau.
- Action: bấm "Đánh giá" → UI hiển thị input "Giá / giá trị hiện tại (VNĐ)" → user nhập `8500000` → bấm "Xác nhận đánh giá".
- Expected: review lưu với `price_snapshot.currentPrice = 8500000`; `changePct` tính từ entry_price.

### 8.2 Abnormal cases

**A-1. `quantity` là số thập phân**
- Input: `{ quantity: 1000.5, ... }`
- Expected: HTTP 400 `{ error: "invalid_quantity" }`.

**A-2. Giá fetch fail trước khi đánh giá STOCK**
- Setup: Vietstock API không phản hồi (timeout).
- Action: bấm "Đánh giá" với STOCK entry.
- Expected: inline panel hiển thị message lỗi "Không lấy được giá — vui lòng thử lại"; không trigger AI; không review mới.

**A-3. User bấm "Hủy" sau khi thấy giá preview**
- Expected: panel đóng lại; nút "Đánh giá" enable lại; không có review mới trong DB.

**A-4. Submit với `asset_type` không hợp lệ**
- Input: `{ asset_type: "BOND", ... }`
- Expected: HTTP 400 `{ error: "invalid_asset_type" }`.

### 8.3 Boundary values

**B-1. `quantity = 0`**
- Expected: HTTP 201 chấp nhận (không bắt buộc; WATCH 0 cổ phiếu là hợp lệ).

**B-2. `buy_amount = 0`**
- Expected: HTTP 201 chấp nhận.

**B-3. `quantity = 500`, `entry_price = 25000` → `buy_amount` auto = 12,500,000**
- Expected: field `buy_amount` hiển thị `12500000`; user không cần nhập tay.

**B-4. Entry cũ có `volume = 10.5`, không có `quantity`**
- GET `/api/decisions/:id` → `{ volume: 10.5, quantity: null, buy_amount: null, asset_type: "STOCK" }` — không lỗi.

**B-5. User nhập `current_price = 0` cho GOLD review**
- Expected: nút "Xác nhận đánh giá" enable (0 là số hợp lệ ≥ 0); `changePct = -100%`.

**B-6. SAVINGS entry với `risk_plan` được gửi kèm từ client**
- Expected: API chấp nhận (không validate); lưu `risk_plan` vào DB mặc dù form ẩn field này.

---

## 9. Open Issues

> Tất cả đã CLOSED (2026-05-26).

| ID | Severity | Quyết định |
|----|----------|-----------|
| ~~OI-1~~ | ~~Blocker~~ | **CLOSED** — `buy_amount` = auto-calculate từ `quantity × entry_price` (onChange), editable bởi user. Khi user sửa tay → giữ giá trị user nhập; tính lại khi `quantity` hoặc `entry_price` thay đổi tiếp. |
| ~~OI-2~~ | ~~Blocker~~ | **CLOSED** — Inline panel trong View 3, xuất hiện khi user bấm "Đánh giá" lần đầu. STOCK: auto-fetch. Non-STOCK: user nhập tay. Sau fetch/nhập → hiện nút "Xác nhận đánh giá" và "Hủy". |
| ~~OI-3~~ | ~~Blocker~~ | **CLOSED** — GOLD/CRYPTO/SAVINGS: user nhập tay `current_price` vào inline input trước khi xác nhận đánh giá. Không tích hợp API ngoài. |
| ~~OI-4~~ | ~~Major~~ | **CLOSED** — Option (a): giữ nguyên column `volume`, thêm `quantity` + `buy_amount` + `asset_type`. Entry cũ hiển thị "—" cho các field mới. |
| ~~OI-5~~ | ~~Major~~ | **CLOSED** — SAVINGS: `entry_price` = số tiền gốc (VNĐ); `quantity` ẩn khỏi form; Risk Plan ẩn khỏi form. `buy_amount` = số tiền gốc (không auto-calc). |

---

## 10. Risks

| ID | Risk | Mức độ | Mitigation |
|----|------|--------|-----------|
| R-1 | **`ALTER TABLE` trên production** lock table | Thấp (single-user, ít data) | Backup trước; chạy ngoài giờ |
| R-2 | **`color-scheme: dark`** ảnh hưởng input ở tab khác | Trung bình | Test toàn bộ dashboard sau khi apply (AC-16) |
| R-3 | **Auto-calculate `buy_amount`** bị reset khi user sửa `entry_price` sau khi đã override tay | Trung bình | AC-3: spec rõ hành vi tính lại; UX cần hiển thị hint "Số tiền đã được tính lại" |
| R-4 | **SAVINGS `entry_price` = số tiền gốc** có thể gây nhầm lẫn trong View 3 nếu label không đổi | Thấp | Đảm bảo label động theo `asset_type` cả ở form lẫn detail view |
| R-5 | **i18n drift** — key thiếu trong 1 ngôn ngữ | Thấp | AC-27: CI check keys diff |
| R-6 | **Vietstock fetch fail** tại bước price preview để user retry | Thấp | AC-10: hiển thị message lỗi rõ ràng + nút retry |

---

## 11. Traceability Table (AC ↔ Component)

| AC | Screen / UI | API endpoint | DB column | Log | Test type |
|----|-------------|--------------|-----------|-----|-----------|
| AC-1 | Form view (View 2) | — | — | — | FE UT |
| AC-2 | Form view — auto-calc | — (client-side) | — | — | FE UT |
| AC-3 | Form view — re-calc on change | — (client-side) | — | — | FE UT |
| AC-4 | Form view | POST/PUT `/api/decisions` | — | validation log | BE UT |
| AC-5 | Form view → Timeline | POST, GET `/api/decisions/:id` | `decision_journal.quantity` | — | BE UT, IT |
| AC-6 | Timeline, Detail view (entry cũ) | GET `/api/decisions`, GET `/:id` | `decision_journal` (volume legacy) | — | BE IT, FE UT |
| AC-7 | Form view (edit legacy entry) | PUT `/api/decisions/:id`, GET | `.quantity`, `.buy_amount` | mutation log | BE IT, E2E |
| AC-8 | — (BE internal) | POST `/api/decisions/:id/reviews` | `decision_review.prompt_hash` | AI call log | BE UT, BB |
| AC-9 | Detail view — price inline (STOCK) | GET `/api/decisions/:id/current-price` | — | — | FE UT, IT |
| AC-10 | Detail view — error state | GET `/api/decisions/:id/current-price` | — | error log | FE UT, BB |
| AC-11 | Detail view — cancel | — (client-side) | — | — | FE UT |
| AC-12 | Detail view — price inline (non-STOCK) | — (client-side input) | — | — | FE UT |
| AC-13 | Detail view → Review card (GOLD) | POST `/api/decisions/:id/reviews` | `decision_review.price_snapshot` | — | BE UT, IT |
| AC-14 | Detail view — SAVINGS confirm disabled | — (client-side) | — | — | FE UT |
| AC-15 | All input fields (datetime-local) | — | — | — | FE visual |
| AC-16 | All tabs (regression) | — | — | — | FE visual, E2E |
| AC-17 | Form view (View 2) | — | — | — | FE UT |
| AC-18 | Form view — SAVINGS mode | — | — | — | FE UT |
| AC-19 | Form view — non-SAVINGS | — | — | — | FE UT |
| AC-20 | Form view — placeholder | — | — | — | FE UT |
| AC-21 | Form view → GET | POST, GET `/api/decisions/:id` | `decision_journal.asset_type` | — | BE UT, IT |
| AC-22 | Form view | POST `/api/decisions` | — | validation log | BE UT |
| AC-23 | Timeline view | GET `/api/decisions?asset_type=GOLD` | `decision_journal.asset_type` | — | BE UT, IT |
| AC-24 | Timeline, Detail (entry cũ) | GET `/api/decisions` | `decision_journal.asset_type` DEFAULT | — | BE IT |
| AC-25 | Timeline view (View 1) | GET `/api/decisions` | `decision_journal.asset_type` | — | FE UT |
| AC-26 | — | GET `/api/decisions` | `decision_journal` (sau ALTER) | — | BE IT |
| AC-27 | — (CI) | — | — | — | CI check |

---

## 12. Phán định

### "Chỉ với Spec Pack này đã có thể bắt đầu implementation chưa?"

**Có (Yes).**

### Lý do

Tất cả 5 Open Issues đã đóng (2026-05-26). Các quyết định cốt lõi rõ ràng:

- **Change A**: `quantity` + `buy_amount` thay `volume`; auto-calc client-side; DB ADD COLUMN giữ `volume`.
- **Change B**: Inline panel trong View 3; STOCK auto-fetch; non-STOCK user nhập tay; 1 endpoint mới nhẹ `GET /:id/current-price`.
- **Change C**: `color-scheme: dark` CSS global.
- **Change D**: `asset_type` enum 4 giá trị; SAVINGS ẩn `quantity` + Risk Plan; DEFAULT `STOCK` xử lý backward compat.

Không còn AC nào bị `[BLOCKED]`.

### Rủi ro còn lại cần theo dõi

| Risk | Ghi chú |
|------|---------|
| **R-2** (CSS regression) | Test toàn bộ dashboard sau khi apply `color-scheme: dark` |
| **R-3** (auto-calc UX) | UX cần hint rõ khi `buy_amount` bị tính lại sau khi user đã override |
| **R-4** (SAVINGS label) | Label `entry_price` trong View 3 (detail) cũng phải đổi theo `asset_type`, không chỉ ở form |
