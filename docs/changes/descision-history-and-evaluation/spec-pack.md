# Spec Pack — Decision History & Evaluation

**Ticket**: Nhật ký & Đánh giá Quyết định Đầu tư (AI-assisted)
**Version**: 0.2 (Phase 1 — All OIs Resolved)
**Date**: 2026-05-24
**Status**: FINAL — tất cả Open Issues đã đóng, sẵn sàng chuyển sang Phase 2

---

## 1. Background / Purpose

Người dùng dashboard đang theo dõi sức khỏe tài chính các ngân hàng (init-web-dashboard) nhưng **không có công cụ ghi lại lý do** đằng sau từng quyết định mua/bán/giữ chứng khoán. Hệ quả: khi nhìn lại không nhớ vì sao đã ra quyết định, không học được bài học từ sai lầm, lặp lại lỗi cũ (FOMO, đặt stop-loss tuỳ tiện, bỏ qua tín hiệu vĩ mô…).

**Mục tiêu** của tính năng:

1. **Ghi nhận** lý do và kế hoạch quản trị rủi ro tại thời điểm ra quyết định (decision journal).
2. **Đánh giá lại** quyết định cũ bằng AI dựa trên diễn biến thị trường thực tế → rút ra bài học có cấu trúc.
3. **Tổng kết** tỉ lệ đúng/sai và các pattern lặp lại để cải thiện chất lượng quyết định trong tương lai.

---

## 2. Scope

### 2.1 Làm gì (In-scope)

- Thêm tab mới **"Quyết định của tôi" / "My Decisions" / "私の決定"** vào dashboard.
- CRUD entries trong `decision_journal` (thêm / sửa / xoá / liệt kê / filter).
- Lưu **kế hoạch quản trị rủi ro** (stop-loss, take-profit nhiều mốc, DCA nhiều ngưỡng, trailing stop, tỉ trọng tối đa).
- Gọi AI để sinh đánh giá có cấu trúc cho mỗi entry; lưu vào `decision_review` (1-N với entry).
- Cho phép người dùng **bổ sung note / bài học cá nhân** bên cạnh đánh giá AI.
- Dashboard tổng kết: tỉ lệ Đúng/Sai theo thời gian, danh sách pattern sai/lặp lại, pattern thành công.
- i18n đầy đủ cho 3 ngôn ngữ hiện có (vi/en/ja).

### 2.2 Không làm (Out-of-scope)

- Đặt lệnh / kết nối broker thực để khớp lệnh.
- Tự động thu thập / nhập giá real-time vào DB (giai đoạn 1 chấp nhận giá nhập tay hoặc nguồn batch — xem [[OI-1]]).
- Sinh khuyến nghị đầu tư chủ động ("nên mua/bán mã X bây giờ").
- Phân tích danh mục tổng (portfolio P&L, allocation report) — chỉ phân tích từng quyết định riêng lẻ.
- Notification / alert khi giá chạm stop-loss / take-profit (giai đoạn sau).
- Backtest chiến lược, paper trading, mô phỏng.
- Export báo cáo PDF/Excel.
- Migration dữ liệu từ hệ thống ghi chú khác.

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| **Decision entry** (entry) | Một bản ghi trong `decision_journal` — mô tả một quyết định tại một thời điểm cụ thể. |
| **Decision review** (review) | Một bản ghi trong `decision_review` — kết quả AI đánh giá cho 1 entry tại 1 thời điểm. Một entry có thể có nhiều review (mỗi lần bấm "Đánh giá" lại tạo 1 review mới — xem [[OI-6]]). |
| **Decision type** | Một trong 4 giá trị: `BUY` (Mua), `SELL` (Bán), `HOLD` (Giữ), `WATCH` (Quan sát). |
| **Risk management plan** | Tập hợp các ngưỡng giá và quy tắc người dùng tự đặt: stop-loss, take-profit (nhiều mốc), DCA, trailing stop, tỉ trọng tối đa. |
| **Stop-loss (SL)** | Ngưỡng giá giảm sẽ cắt lỗ. Có thể là giá tuyệt đối (vd: 25,000đ) hoặc % so với giá vào lệnh (vd: -8%). |
| **Take-profit (TP)** | Ngưỡng giá tăng sẽ chốt lời. Có thể nhiều mốc (TP1/TP2/TP3) kèm tỉ trọng chốt tại mỗi mốc (vd: TP1 = +15%, chốt 30% vị thế). |
| **DCA** | Dollar-Cost Averaging — kế hoạch mua thêm khi giá giảm tới ngưỡng định trước. |
| **Trailing stop** | Quy tắc nâng dần stop-loss khi giá tăng đạt mốc nhất định. |
| **AI verdict** | Một trong 3 giá trị: `CORRECT` (Đúng), `WRONG` (Sai), `UNCLEAR` (Chưa rõ). |
| **Pattern** | Một mô tả ngắn (text) do AI gom lại từ nhiều bài học, được đánh dấu là "lặp lại" khi xuất hiện trong ≥ N entries (N do [[OI-7]] quyết định). |

---

## 4. As-Is / To-Be

### 4.1 As-Is

- Dashboard hiện có 3 tab cốt lõi (Bank List / Trend / Ranking) + 2 tab phụ (Screening / Valuation).
- Không có nơi nào trong dashboard cho phép người dùng ghi chú quyết định cá nhân.
- Người dùng (chính owner) đang ghi rời rạc bằng note tay / file riêng → không truy xuất được, không liên kết với dữ liệu giá thực tế.
- Không có cơ chế đánh giá lại quyết định.

### 4.2 To-Be

- Dashboard có thêm tab **"Quyết định của tôi"** gồm 3 view phụ:
  1. **Danh sách (Timeline)** — liệt kê các entry, có filter.
  2. **Form thêm/sửa** — nhập entry mới hoặc chỉnh sửa entry hiện có.
  3. **Chi tiết & Đánh giá** — xem 1 entry, các review của nó, nút "Đánh giá", note cá nhân.
- Tab thứ hai **"Tổng kết quyết định"** (hoặc một panel riêng cùng tab) — hiển thị tỉ lệ Đúng/Sai theo thời gian + pattern.
- Backend lộ thêm các endpoint REST cho CRUD entry + review (xem [§5.4](#54-api-endpoints)).
- DB có thêm 2 bảng: `decision_journal`, `decision_review` (xem [§5.5](#55-db-schema)).

---

## 5. Detailed Specification

### 5.1 Feature A — Tab "Quyết định của tôi" (Decision Journal)

#### 5.1.1 View 1 — Timeline / Danh sách entry

- Liệt kê tất cả entry, mặc định sắp xếp theo `decided_at DESC` (mới nhất lên đầu).
- Filter:
  - **Theo mã chứng khoán** (StockCode) — text input.
  - **Theo loại quyết định** — multi-select trong {BUY, SELL, HOLD, WATCH}.
  - **Theo khoảng thời gian** — `from` / `to` date.
- Mỗi hàng hiển thị: `decided_at`, `ticker`, `type`, `entry_price`, `volume`, trích đoạn `reason` (cắt ~120 ký tự), badge "Đã đánh giá" nếu có ≥ 1 review.
- Nút **"+ Thêm quyết định"** dẫn tới View 2.
- Click vào hàng → View 3 (chi tiết).
- Trạng thái rỗng: hiển thị "Chưa có quyết định nào — bấm '+ Thêm' để bắt đầu".

#### 5.1.2 View 2 — Form thêm/sửa entry

**Các trường (theo description.md):**

| Field | Type | Required | Note |
|-------|------|----------|------|
| `ticker` | string (3 ký tự, uppercase) | ✅ | Không validate giới hạn chỉ ngân hàng — cho phép mã chứng khoán bất kỳ |
| `decision_type` | enum {BUY, SELL, HOLD, WATCH} | ✅ | |
| `decided_at` | datetime | ✅ | Default = now |
| `entry_price` | number (≥ 0) | ✅ với BUY/SELL; tuỳ chọn với HOLD/WATCH | Đơn vị: VND |
| `volume` | number (≥ 0) | ❌ | % danh mục đầu tư (vd: 10.5 nghĩa là 10.5% danh mục) |
| `risk_plan` | object (xem dưới) | ✅ với BUY; tuỳ chọn với SELL/HOLD/WATCH | |
| `reason` | text (tối thiểu 20 ký tự, tối đa 5,000 ký tự) | ✅ | Quan trọng — input chính cho AI |
| `confidence` | integer 1–5 | ❌ | Mức độ tự tin |
| `mood` | enum {CALM, EXCITED, FEARFUL, FOMO, NEUTRAL} | ❌ | Tâm trạng |
| `sources` | text (tối đa 1,000 ký tự) | ❌ | Nguồn tham khảo (link hoặc text) |

**Schema `risk_plan` (JSON):**

```json
{
  "stop_loss": { "mode": "abs"|"pct", "value": number },          // bắt buộc khi BUY
  "take_profits": [ { "mode": "abs"|"pct", "value": number, "exit_pct": number } ],  // 0..n mốc; tổng exit_pct ≤ 100
  "dca_levels":   [ { "mode": "abs"|"pct", "value": number, "add_volume": number } ],// 0..n mốc; value < entry_price
  "trailing_stop": { "trigger_pct": number, "new_sl_pct": number } | null,
  "max_portfolio_pct": number  // 0 < x ≤ 100
}
```

(Chi tiết schema sẽ chốt khi [[OI-5]] đóng.)

**Hành vi form:**

- Validate client-side trước khi submit (kiểu, range, required).
- Submit → POST `/api/decisions` (tạo mới) hoặc PUT `/api/decisions/:id` (sửa).
- Sau khi tạo thành công → quay về View 1.
- Lỗi server (5xx, 4xx) → hiển thị message; **không** clear form.

#### 5.1.3 View 3 — Chi tiết entry & các review

- Hiển thị **đầy đủ** các trường của entry.
- Render `risk_plan` thành bảng dễ đọc (không show raw JSON).
- Nút **"Đánh giá"** (chỉ enable khi entry đã tồn tại ≥ 1 ngày — tránh đánh giá ngay sau khi mua khi chưa có biến động).
- Danh sách review (sắp xếp theo `reviewed_at DESC`): mỗi review hiển thị 4 mục có cấu trúc (Kết luận / Điểm hợp lý / Điểm yếu / Bài học) + `reviewed_at` + (nếu có) price snapshot tại thời điểm review.
- Khu vực **note cá nhân** (`user_note`, max 2,000 ký tự) — gắn với entry (không gắn từng review), edit inline, auto-save khi blur.
- Nút **"Sửa"** → View 2 (pre-fill).
- Nút **"Xoá"** → confirm dialog → DELETE `/api/decisions/:id` → soft-delete (xem [§5.5](#55-db-schema)).

---

### 5.2 Feature B — AI Review

#### 5.2.1 Trigger

- Người dùng bấm nút **"Đánh giá"** trên View 3 (manual trigger).
- Không có auto-trigger trong scope giai đoạn 1.

#### 5.2.2 Nguồn dữ liệu giá (đã quyết định — OI-1 CLOSED)

Backend **fetch giá từ Vietstock** khi người dùng bấm "Đánh giá" — cùng pattern với code định giá hiện tại (`backend/src/paybacktime/GetTradeInfo.ts`).

**Auth**: `VIETSTOCK_COOKIE` + `VIETSTOCK_TOKEN` từ `.env` (đã có sẵn).  
**HTTP client**: axios, POST form-urlencoded, timeout 10s — giống `GetTradeInfo`.

Hai loại dữ liệu cần fetch:

| Dữ liệu | Endpoint Vietstock | Ghi chú |
|---------|--------------------|---------|
| **Giá hiện tại** | `finance.vietstock.vn/company/tradinginfo` | Tái sử dụng hàm `GetTradeInfo(ticker)` đã có — trả `LastPrice` |
| **Lịch sử giá** (daily close từ `decided_at` đến `now`) | `finance.vietstock.vn/company/historicalquote` | Cùng pattern auth; tham số: `code`, `startDate`, `endDate` (xác nhận exact params khi implementation) |

Backend tính từ lịch sử giá:
- % thay đổi so với `entry_price`.
- Đỉnh (`max_price` + ngày), đáy (`min_price` + ngày) trong khoảng.
- Đã chạm `stop_loss` hay chưa? Đã chạm `take_profit` mốc nào chưa?
- Lấy thêm lịch sử `VNINDEX` cùng khoảng bằng cùng endpoint (ticker = `"VNINDEX"`).

Nếu fetch thất bại (timeout, 4xx, 5xx, cookie hết hạn) → trả 503 `{ error: "price_fetch_failed" }`, **không** tiến hành review; FE hiển thị "Không lấy được giá — vui lòng thử lại".

#### 5.2.3 Context gửi cho AI

Backend build prompt với các thông tin sau:

1. **Entry**: `ticker`, `decision_type`, `decided_at`, `entry_price`, `volume` (% danh mục), `risk_plan`, `reason`, `confidence`, `mood`, `sources`.
2. **Diễn biến giá** từ `decided_at` đến `now` (fetch từ internet — xem [§5.2.2](#522-ngun-d-liu-gi)):
   - Giá hiện tại (`current_price`).
   - % thay đổi so với `entry_price`.
   - Đỉnh / đáy trong khoảng (`max_price`, `min_price` + ngày).
   - Đã chạm `stop_loss` hay chưa? Đã chạm `take_profit` mốc nào chưa?
3. **Bối cảnh thị trường**: biến động VN-Index (VNINDEX) cùng khoảng — fetch cùng request giá.

#### 5.2.4 Output AI

Bắt buộc trả về JSON đúng schema:

```json
{
  "verdict": "CORRECT" | "WRONG" | "UNCLEAR",
  "verdict_reason": "string, 1-3 câu",
  "strengths":  ["string", "..."],  // 1..5 điểm hợp lý trong lập luận
  "weaknesses": ["string", "..."],  // 0..5 điểm yếu / sai lầm
  "lessons":    ["string", "..."]   // 1..3 bài học có thể áp dụng cho lần sau
}
```

- Nếu AI trả về JSON sai schema → backend retry 1 lần với prompt nhấn mạnh schema; thất bại lần 2 → trả 502 + log raw response; **không** lưu review.
- Lưu kèm: `reviewed_at`, `model_id` (vd `claude-opus-4-7`), `price_snapshot` (object 2.b ở trên), `raw_prompt_hash` (sha256 để debug, không lưu raw prompt vì tốn dung lượng).

#### 5.2.5 AI provider & model (đã quyết định — OI-2 CLOSED)

- **Provider**: Anthropic Claude API.
- **Model**: `claude-sonnet-4-6`.
- **API Key**: đọc từ `process.env.ANTHROPIC_API_KEY` (file `.env`, không commit vào git).
- **Budget**: < 10 USD/tháng — không cần cap vì single-user bấm thủ công khi cần (OI-8 CLOSED).

#### 5.2.6 Edit / Note cá nhân

- Không cho phép sửa nội dung review do AI sinh.
- Người dùng ghi bài học của họ vào `user_note` ở cấp entry (xem [§5.1.3](#513-view-3--chi-tit-entry--cc-review)).

---

### 5.3 Feature C — Dashboard tổng kết

#### 5.3.1 Tỉ lệ Đúng / Sai theo thời gian

- Pie chart hoặc stacked bar: `CORRECT` / `WRONG` / `UNCLEAR`, tính từ **review mới nhất** của mỗi entry (không double-count entry có nhiều review).
- Filter theo khoảng thời gian (theo `decided_at`).
- Hiển thị tổng số entry và tỉ lệ %.

#### 5.3.2 Pattern lặp lại (đã quyết định — OI-7 CLOSED)

- "Pattern sai lầm lặp lại" — danh sách text ngắn (1-2 câu mỗi pattern), kèm số lần AI nhận thấy.
- "Pattern thành công" — tương tự.

**Trigger**: Người dùng bấm nút **"Tính pattern"** trên Summary view → AI phân tích toàn bộ `lessons` + `weaknesses` từ tất cả review hiện có → trả kết quả mới → FE cập nhật + lưu `pattern_cache` vào DB (timestamp + JSON result). Nếu người dùng không bấm → FE hiển thị kết quả từ `pattern_cache` lần tính cuối (kèm timestamp "Tính lúc: dd/MM/yyyy HH:mm").

**Lần đầu chưa có cache**: hiển thị "Chưa có pattern — bấm 'Tính pattern' để phân tích".

**AI tự quyết threshold**: không hardcode N trong code; prompt yêu cầu AI chỉ nêu pattern khi nó xuất hiện rõ ràng nhiều lần và có ý nghĩa thực tế.

- Nếu chưa đủ dữ liệu (số review < 5): hiển thị "Cần ít nhất 5 đánh giá để phát hiện pattern".

---

### 5.4 API Endpoints

Tuân theo [api-conventions.md](../../standards/api-conventions.md): shape `{ data, meta? }`, NULL pass-through, không hardcode credentials.

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/decisions` | List entries, hỗ trợ query: `?ticker=&type=&from=&to=&limit=&offset=` |
| GET | `/api/decisions/:id` | Chi tiết 1 entry + tất cả review (eager load) |
| POST | `/api/decisions` | Tạo entry mới |
| PUT | `/api/decisions/:id` | Sửa entry (toàn bộ — PATCH không hỗ trợ giai đoạn 1) |
| DELETE | `/api/decisions/:id` | Soft-delete entry |
| PUT | `/api/decisions/:id/note` | Cập nhật `user_note` |
| POST | `/api/decisions/:id/reviews` | Trigger AI review → tạo review mới |
| GET | `/api/decisions/:id/reviews` | List review của 1 entry |
| GET | `/api/decisions/summary` | Tỉ lệ Đúng/Sai + pattern_cache lần cuối, hỗ trợ `?from=&to=` |
| POST | `/api/decisions/summary/pattern` | Trigger AI tính pattern mới → lưu cache → trả kết quả |

**Response shapes:** thống nhất camelCase trong JSON (như convention hiện tại). Định nghĩa interface chi tiết để sang Phase 3 ([impl-plan]) viết ra.

---

### 5.5 DB Schema

Hai bảng mới trong DB `finance` (cùng database với `bctc_new`).

#### `decision_journal`

| Column | Type | Note |
|--------|------|------|
| `id` | BIGINT PK AUTO_INCREMENT | |
| `ticker` | VARCHAR(10) NOT NULL | Cho phép mã > 3 ký tự (tương lai có thể chứng khoán quốc tế) |
| `decision_type` | ENUM('BUY','SELL','HOLD','WATCH') NOT NULL | |
| `decided_at` | DATETIME NOT NULL | |
| `entry_price` | DOUBLE NULL | NULL hợp lệ với HOLD/WATCH |
| `volume` | DOUBLE NULL | % danh mục đầu tư (vd: 10.5 = 10.5%) |
| `risk_plan` | JSON NULL | Schema xem [§5.1.2](#512-view-2--form-thmsa-entry) |
| `reason` | TEXT NOT NULL | |
| `confidence` | TINYINT NULL | 1–5 |
| `mood` | ENUM(...) NULL | |
| `sources` | TEXT NULL | |
| `user_note` | TEXT NULL | Note cá nhân, edit độc lập với entry chính |
| `created_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME NOT NULL ON UPDATE CURRENT_TIMESTAMP | |
| `deleted_at` | DATETIME NULL | Soft-delete |

Index: `(ticker, decided_at)`, `(decision_type)`, `(deleted_at)`.

#### `decision_review`

| Column | Type | Note |
|--------|------|------|
| `id` | BIGINT PK AUTO_INCREMENT | |
| `decision_id` | BIGINT NOT NULL FK → `decision_journal.id` ON DELETE CASCADE | |
| `reviewed_at` | DATETIME NOT NULL | |
| `verdict` | ENUM('CORRECT','WRONG','UNCLEAR') NOT NULL | |
| `verdict_reason` | TEXT NOT NULL | |
| `strengths` | JSON NOT NULL | Array of string |
| `weaknesses` | JSON NOT NULL | Array of string |
| `lessons` | JSON NOT NULL | Array of string |
| `price_snapshot` | JSON NOT NULL | `{ now, change_pct, max, min, sl_hit, tp_hits }` |
| `model_id` | VARCHAR(64) NOT NULL | Vd `claude-opus-4-7` |
| `prompt_hash` | CHAR(64) NOT NULL | SHA256 prompt, debug |

Index: `(decision_id, reviewed_at)`.

---

### 5.6 i18n

- Tất cả label, button, message UI mới → keys trong `frontend/src/locales/{vi,en,ja}.json`.
- Namespace đề xuất: `decisions.*` (vd: `decisions.tab_title`, `decisions.form.ticker`, `decisions.review.verdict.correct`).
- AI review output (verdict_reason, strengths, weaknesses, lessons) trả về theo **ngôn ngữ người dùng đang chọn** — backend nhận `?lang=vi|en|ja` (default `vi`) và truyền vào prompt template.

---

## 6. Non-Functional Requirements

| # | Hạng mục | Yêu cầu |
|---|----------|--------|
| NFR-1 | **Latency** | List/CRUD entry: P95 < 300ms. AI review: ưu tiên correctness; UI phải hiển thị spinner + cho phép cancel. Time-out 60s. |
| NFR-2 | **Bảo mật** | Không lộ AI API key trong frontend hoặc git. Key đọc từ env (`AI_API_KEY` hoặc tương đương). Reason / note có thể chứa thông tin cá nhân — không log raw vào console. |
| NFR-3 | **Đa ngôn ngữ** | 3 ngôn ngữ (vi/en/ja) cho UI + AI output. |
| NFR-4 | **Responsive** | Minimum 1280px (giữ baseline của dashboard). Mobile out-of-scope. |
| NFR-5 | **Compatibility** | Không break các tab hiện có (Bank List / Trend / Ranking / Screening / Valuation). |
| NFR-6 | **Data retention** | Soft-delete cho entry. Review không tự xoá. Không có cron purge giai đoạn 1. |
| NFR-7 | **AI cost** | Single-user, bấm thủ công khi cần — không cần cap tự động. Budget guideline: < 10 USD/tháng; model `claude-sonnet-4-6`. |
| NFR-8 | **Observability** | Log AI request: `decision_id`, `model_id`, latency, token count, success/failure (không log prompt/response raw). |
| NFR-9 | **Error UX** | Mọi state lỗi đều render message rõ ràng (không blank screen / crash). |

---

## 7. Acceptance Criteria (AC)

> Mỗi AC viết thành 1 câu khẳng định kiểm thử được. AC nào liên quan đến Open Issue Blocker được đánh dấu **[BLOCKED]** — chưa testable cho tới khi OI đóng.

### Decision Journal CRUD

- **AC-1**. Khi user mở tab "Quyết định của tôi" lần đầu (DB rỗng), UI hiển thị message rỗng và nút "+ Thêm quyết định".
- **AC-2**. Khi user submit form với đầy đủ field bắt buộc (ticker, decision_type, decided_at, reason ≥ 20 ký tự, và `entry_price` nếu BUY/SELL, `risk_plan` nếu BUY), entry được lưu và xuất hiện ở đầu danh sách timeline.
- **AC-3**. Khi user submit form thiếu `reason` (hoặc reason < 20 ký tự), API trả 400 và UI hiển thị inline error gắn với field; form không bị clear.
- **AC-4**. Khi user submit BUY mà thiếu `risk_plan.stop_loss`, API trả 400 với `error: "stop_loss_required_for_buy"`.
- **AC-5**. Khi user filter danh sách theo `ticker=VCB` và `type=BUY,HOLD`, chỉ entries match cả 2 điều kiện được trả về.
- **AC-6**. Khi user filter theo khoảng `from=2026-01-01 & to=2026-03-31`, chỉ entries có `decided_at` thuộc khoảng (inclusive) được trả về.
- **AC-7**. Khi user xoá 1 entry, entry bị soft-delete (`deleted_at` set) và biến mất khỏi mọi list endpoint; review gắn với entry vẫn tồn tại nhưng cũng không trả về.
- **AC-8**. Khi user sửa 1 entry, `updated_at` được cập nhật; các review cũ vẫn được giữ lại (không bị xoá).
- **AC-9**. `risk_plan.take_profits[].exit_pct` tổng phải ≤ 100; nếu > 100 → API trả 400.

### AI Review

- **AC-10**. Nút "Đánh giá" bị disable khi `now - decided_at < 24h`.
- **AC-11**. Khi user bấm "Đánh giá", backend gọi AI và (a) lưu review mới với verdict ∈ {CORRECT, WRONG, UNCLEAR}, (b) phản hồi entry kèm danh sách review cập nhật.
- **AC-12**. Nếu AI trả JSON sai schema, backend retry 1 lần; nếu fail tiếp → trả 502, **không** lưu review nào, log có chứa `prompt_hash`.
- **AC-13**. Mỗi review lưu kèm `model_id`, `reviewed_at`, `price_snapshot.current_price`, `price_snapshot.change_pct`; dữ liệu giá được fetch từ VNDirect API (fallback SSI/Cafef) tại thời điểm bấm "Đánh giá".
- **AC-14**. Khi user mở chi tiết entry đã có ≥ 2 review, các review được hiển thị theo `reviewed_at DESC`.
- **AC-15**. User cập nhật `user_note` → PUT `/api/decisions/:id/note` lưu thành công và GET sau đó trả về note mới.
- **AC-16**. Khi `?lang=en`, output AI (verdict_reason, strengths, weaknesses, lessons) được trả bằng tiếng Anh; `?lang=ja` trả tiếng Nhật; default `vi`.
- **AC-17**. ~~Cap review~~ — **N/A**: single-user, không có cap tự động (OI-3, OI-8 CLOSED).

### Summary Dashboard

- **AC-18**. `/api/decisions/summary` trả về `{ correct, wrong, unclear, total }` tính từ review **mới nhất** của mỗi entry (entry chưa có review nào → loại khỏi denominator).
- **AC-19**. Khi tổng số review < 5, response chứa `patterns: []` và FE hiển thị "Cần thêm dữ liệu để phát hiện pattern".
- **AC-20**. Khi người dùng bấm "Tính pattern", POST `/api/decisions/summary/pattern` gọi AI, lưu kết quả + timestamp vào `pattern_cache`, FE hiển thị danh sách pattern + "Tính lúc: dd/MM/yyyy HH:mm". Nếu chưa bấm lần nào → hiển thị "Chưa có pattern — bấm 'Tính pattern' để phân tích".

### Non-Functional

- **AC-21**. List endpoint `/api/decisions` với 1,000 entries phản hồi P95 < 300ms (đo với cold DB cache).
- **AC-22**. AI API key không xuất hiện trong bundle JS frontend (kiểm tra qua grep build output).
- **AC-23**. Mọi label UI mới có key trong cả 3 file locale (vi/en/ja) — kiểm bằng script so sánh keys.
- **AC-24**. Khi AI request timeout > 60s, FE hiển thị message "Đánh giá quá lâu — vui lòng thử lại" và không lưu review.

---

## 8. Examples

### 8.1 Normal cases

**N-1. Mua VCB với kế hoạch quản trị rủi ro đầy đủ**
- Input: `{ ticker: "VCB", decision_type: "BUY", decided_at: "2026-05-24T09:30:00", entry_price: 92000, volume: 100, risk_plan: { stop_loss: {mode:"pct", value:-8}, take_profits: [{mode:"pct", value:15, exit_pct:50}, {mode:"pct", value:25, exit_pct:50}], dca_levels: [], max_portfolio_pct: 10 }, reason: "Kết quả Q1 vượt kỳ vọng, NPL giảm, định giá P/B 1.5x là hợp lý so với ngành 1.8x" }`
- Expected: HTTP 201, entry xuất hiện ở đầu timeline, badge "Chưa đánh giá".

**N-2. Đánh giá lại entry sau 60 ngày**
- State: entry N-1 ở trên, giá hiện tại VCB = 105,000 (+14.1%).
- Action: bấm "Đánh giá".
- Expected: HTTP 200, review mới với `verdict ∈ {CORRECT, WRONG, UNCLEAR}`, `price_snapshot.change_pct ≈ 14.1`, `tp_hits` chứa TP1 (15% chưa đạt) hoặc rỗng.

### 8.2 Abnormal cases

**A-1. AI trả JSON sai schema 2 lần liên tiếp**
- Setup: mock AI provider trả về plain text.
- Action: bấm "Đánh giá".
- Expected: HTTP 502 `{ error: "ai_invalid_response" }`, không có row mới trong `decision_review`, log chứa `prompt_hash`.

**A-2. Submit form BUY thiếu `stop_loss`**
- Input: `{ ticker:"TCB", decision_type:"BUY", entry_price:25000, reason:"...", risk_plan:{ take_profits:[...], max_portfolio_pct:5 } }`
- Expected: HTTP 400 `{ error: "stop_loss_required_for_buy" }`, form không clear, error gắn với field stop_loss.

### 8.3 Boundary values

**B-1. `reason` đúng tối thiểu 20 ký tự**
- Input: `reason: "x".repeat(20)` (đúng 20 ký tự).
- Expected: HTTP 201 (chấp nhận).

**B-2. `reason` 19 ký tự**
- Input: `reason: "x".repeat(19)`.
- Expected: HTTP 400.

**B-3. `take_profits` tổng `exit_pct` = 100**
- Input: 2 mốc với `exit_pct: 60` và `exit_pct: 40`.
- Expected: HTTP 201.

**B-4. `take_profits` tổng `exit_pct` = 101**
- Input: 2 mốc với `exit_pct: 60` và `exit_pct: 41`.
- Expected: HTTP 400 `{ error: "take_profit_exit_pct_exceeds_100" }`.

**B-5. Nút "Đánh giá" tại thời điểm `decided_at + 24h - 1s`**
- Expected: button disabled.

**B-6. Nút "Đánh giá" tại thời điểm `decided_at + 24h`**
- Expected: button enabled.

---

## 9. Open Issues

> Tất cả đã CLOSED (2026-05-24).

| ID | Severity | Quyết định |
|----|----------|-----------|
| ~~OI-1~~ | ~~Blocker~~ | **CLOSED** — Backend fetch giá từ Vietstock (`tradinginfo` cho giá hiện tại, `historicalquote` cho lịch sử), cùng pattern với `GetTradeInfo.ts`. Auth: `VIETSTOCK_COOKIE` + `VIETSTOCK_TOKEN`. |
| ~~OI-2~~ | ~~Blocker~~ | **CLOSED** — Claude API, model `claude-sonnet-4-6`, key `ANTHROPIC_API_KEY` trong `.env`. |
| ~~OI-3~~ | ~~Blocker~~ | **CLOSED** — Single-user, kế thừa no-auth. Không cần `user_id` trong schema. |
| ~~OI-4~~ | ~~Major~~ | **CLOSED** — UI tự thiết kế theo style dashboard hiện tại (tab đồng nhất với Bank List / Screening / Valuation). |
| ~~OI-5~~ | ~~Major~~ | **CLOSED** — JSON column cho `risk_plan`. |
| ~~OI-6~~ | ~~Major~~ | **CLOSED** — Mỗi lần bấm "Đánh giá" → tạo review mới, lưu kèm `reviewed_at`. Không overwrite. Không cap. |
| ~~OI-7~~ | ~~Major~~ | **CLOSED** — Manual trigger: user bấm nút "Tính pattern" → AI tính → lưu cache + timestamp. Không bấm → hiển thị kết quả cache cũ. AI tự quyết threshold (không hardcode N). |
| ~~OI-8~~ | ~~Major~~ | **CLOSED** — Single-user, bấm thủ công. Không cần cap. |
| ~~OI-9~~ | ~~Minor~~ | **CLOSED** — `volume` = % danh mục (DOUBLE). |
| ~~OI-10~~ | ~~Minor~~ | **CLOSED** — Đơn vị VND. Định dạng: hiển thị với dấu phân cách nghìn (1,000,000). |
| ~~OI-11~~ | ~~Minor~~ | **CLOSED** — Không cần audit log. Chỉ `updated_at`. |

---

## 10. Risks

| ID | Risk | Mức độ | Mitigation đề xuất |
|----|------|--------|-------------------|
| R-1 | **Chi phí AI vượt kiểm soát** — user spam nút "Đánh giá" | Cao | NFR-7 cap; cache: nếu review gần nhất < 24h cùng entry → trả lại, không gọi AI |
| R-2 | **AI hallucinate / verdict sai lệch hệ thống** | Trung bình | Prompt template chuẩn, lưu `prompt_hash` để reproduce; cho phép user override bằng `user_note` |
| R-3 | **Thiếu dữ liệu giá** ([[OI-1]] chưa đóng) → review thiếu context, verdict không có ý nghĩa | Cao (Blocker) | Đóng [[OI-1]] trước implementation |
| R-4 | **Lộ key AI provider** trong frontend | Cao | NFR-2: tuyệt đối không gọi AI từ FE, mọi call qua BE |
| R-5 | **Multi-user data leakage** nếu sau này thêm auth nhưng schema không có `user_id` | Cao nếu chuyển sang multi-user | Quyết định [[OI-3]] sớm; nếu single-user, document rõ "không scale ra multi-user mà không migration" |
| R-6 | **JSON column khó migrate** nếu sau đổi sang bảng con cho risk_plan | Trung bình | Migration script chuyển JSON → rows; viết test |
| R-7 | **i18n drift** — keys thiếu trong 1 trong 3 locale | Thấp | AC-23: script CI so sánh keys |
| R-8 | **Trigger AI trên entry vừa tạo (chưa có biến động giá)** → review vô nghĩa | Thấp | AC-10: disable button 24h đầu |

---

## 11. Traceability Table (AC ↔ component)

| AC | Screen / UI | API endpoint | DB table | Log / Audit | Permissions | Test type |
|----|-------------|--------------|----------|-------------|-------------|-----------|
| AC-1 | Decisions tab (Timeline view) | GET `/api/decisions` | `decision_journal` | — | public (giả định OI-3 = single-user) | FE UT, E2E |
| AC-2 | Form view | POST `/api/decisions` | `decision_journal` INSERT | request log | public | BE UT, IT, FE UT, E2E |
| AC-3 | Form view | POST `/api/decisions` | — | validation log | public | BE UT, FE UT |
| AC-4 | Form view | POST `/api/decisions` | — | validation log | public | BE UT |
| AC-5 | Timeline view | GET `/api/decisions?ticker=&type=` | `decision_journal` SELECT | — | public | BE UT, IT |
| AC-6 | Timeline view | GET `/api/decisions?from=&to=` | `decision_journal` SELECT | — | public | BE UT, IT |
| AC-7 | Detail view (xoá) | DELETE `/api/decisions/:id` | `decision_journal` UPDATE (soft-delete), `decision_review` không xoá | mutation log | public | BE UT, IT, E2E |
| AC-8 | Form view (sửa) | PUT `/api/decisions/:id` | `decision_journal` UPDATE | mutation log | public | BE UT, IT |
| AC-9 | Form view (validation) | POST/PUT `/api/decisions` | — | validation log | public | BE UT |
| AC-10 | Detail view (button) | — (client-side) | — | — | public | FE UT |
| AC-11 | Detail view → Review section | POST `/api/decisions/:id/reviews` | `decision_review` INSERT | AI call log (NFR-8) | public | BE UT, IT, BB |
| AC-12 | Detail view | POST `/api/decisions/:id/reviews` | (no INSERT) | error log với prompt_hash | public | BE UT, BB |
| AC-13 | Detail view → Review card | POST `/api/decisions/:id/reviews` | `decision_review.price_snapshot` | — | public | BE UT, IT — **BLOCKED OI-1** |
| AC-14 | Detail view | GET `/api/decisions/:id` (eager) hoặc GET `/api/decisions/:id/reviews` | `decision_review` SELECT | — | public | BE UT, FE UT |
| AC-15 | Detail view (note) | PUT `/api/decisions/:id/note` | `decision_journal.user_note` UPDATE | mutation log | public | BE UT, IT |
| AC-16 | Detail view → Review card | POST `/api/decisions/:id/reviews?lang=` | `decision_review` lưu | — | public | BE UT, IT |
| ~~AC-17~~ | N/A | N/A | N/A | N/A | N/A | N/A — removed (single-user, no cap) |
| AC-18 | Summary view | GET `/api/decisions/summary` | `decision_review` + `decision_journal` JOIN | — | public | BE UT, IT |
| AC-19 | Summary view | GET `/api/decisions/summary` | — | — | public | BE UT, FE UT |
| AC-20 | Summary view (Pattern panel) + "Tính pattern" button | POST `/api/decisions/summary/pattern`, GET `/api/decisions/summary` | `decision_review` + `pattern_cache` | AI call log | public | BE UT, IT, FE UT, BB |
| AC-21 | Timeline (load 1k entries) | GET `/api/decisions` | `decision_journal` SELECT | — | public | Performance test |
| AC-22 | Build output | — | — | — | — | CI check (grep) |
| AC-23 | All UI | — | — | — | — | CI check (i18n keys diff) |
| AC-24 | Detail view → Review action | POST `/api/decisions/:id/reviews` | (no INSERT) | timeout log | public | FE UT, BB |

---

## 12. Phán định (Phase 1 verdict)

### "Chỉ với Spec Pack này đã có thể bắt đầu implementation chưa?"

**Có (Yes).**

### Lý do

Tất cả 11 Open Issues đã được đóng (2026-05-24). Các quyết định kiến trúc cốt lõi đã rõ:

- **Data flow**: CRUD (MySQL) + AI review (Claude `claude-sonnet-4-6`) + price fetch (VNDirect API).
- **Auth**: none (single-user, kế thừa baseline).
- **Schema**: 2 bảng mới (`decision_journal`, `decision_review`) + 1 bảng cache (`pattern_cache` hoặc field trong `app_settings`).
- **UI**: tab mới đồng nhất style dashboard hiện tại.

Không còn AC nào bị `[BLOCKED]`. Sẵn sàng chuyển sang **Phase 2** (áp context kỹ thuật + tạo impl-plan draft).

### Rủi ro còn lại cần theo dõi trong implementation

| Risk | Ghi chú |
|------|---------|
| **R-1** (AI cost) | Monitor token usage; nếu vượt $10/tháng thì review lại cách build prompt |
| **R-3** (fetch giá) | VNDirect API public có thể thay đổi — cần abstract `PriceFetcher` interface để dễ swap sang nguồn khác |
| **R-4** (lộ key) | Verify trong Phase 5: `ANTHROPIC_API_KEY` không có trong bundle FE |
