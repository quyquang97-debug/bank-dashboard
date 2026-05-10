# Spec Pack — filter-by-year-quarter

**Version**: 1.2  
**Date**: 2026-05-09  
**Status**: FINAL — tất cả Open Issues đã đóng; sẵn sàng implementation

---

## 1. Background / Purpose

Hiện tại Bank List và Ranking luôn hiển thị theo kỳ "mới nhất" tự động (detectWindow + fallback MAX) — người dùng không thể xem dữ liệu kỳ khác mà không truy vấn DB thủ công.

Mục tiêu: Bổ sung bộ lọc (Year, Quarter) để người dùng chủ động chọn kỳ báo cáo. Bank List, Ranking, và Trend Chart đều cập nhật theo kỳ được chọn.

---

## 2. Scope

### Làm gì (In-scope)

- Thêm bộ lọc (Year, Quarter) lên UI — 1 dropdown ghép, hiển thị dạng "Q4/2024" hoặc "2023 (Năm)"
- Bank List cập nhật dữ liệu theo kỳ được chọn
- **Ranking chart cập nhật theo kỳ được chọn** (RANK() OVER chỉ tính trên rows của kỳ đó) — ✅ OI-1 đã đóng
- **Trend chart cắt lịch sử tại kỳ được chọn** (chỉ hiển thị dữ liệu ≤ kỳ đó) — ✅ OI-2 đã đóng
- Danh sách kỳ khả dụng lấy từ DB qua endpoint mới `GET /api/periods`
- Trạng thái mặc định = kỳ hiện tại (detectCurrentPeriod)
- Xử lý trạng thái rỗng nếu kỳ chọn không có dữ liệu
- `selectedPeriod` là shared state ở `App.tsx`, truyền xuống BankList, RankingChart, và TrendChart

### Không làm (Out-of-scope)

- Trend chart hiển thị dữ liệu của kỳ **sau** kỳ được chọn (chỉ cắt từ kỳ đó trở về trước, không filter riêng theo bank)
- Lưu trạng thái filter vào URL params hoặc localStorage
- Filter theo nhiều kỳ cùng lúc
- Year-only filter (bắt buộc luôn chọn cả Year lẫn Quarter — ✅ OI-3 đã đóng)
- Tạo/chỉnh sửa dữ liệu BCTC từ dashboard

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| Kỳ báo cáo | (Year, Quarter) xác định một tập dữ liệu trong `bctc_new`. Quarter=0 = báo cáo năm; Quarter=1–4 = báo cáo quý |
| Kỳ hiện tại | (Year, Quarter) được xác định bởi `detectWindow(today)` + fallback MAX(Year×10+Quarter) — logic hiện có |
| Bộ lọc kỳ | UI dropdown cho phép chọn 1 kỳ (Year+Quarter cùng lúc), ảnh hưởng tới Bank List, Ranking, và Trend |
| Kỳ khả dụng | Tập hợp (Year, Quarter) thực sự có ít nhất 1 bản ghi trong `bctc_new` |
| selectedPeriod | State `{ year: number, quarter: number }` ở App.tsx, shared xuống BankList, RankingChart, và TrendChart |
| Cutoff | Điểm cắt lịch sử trong Trend chart: chỉ hiển thị dữ liệu có (Year×10+Quarter) ≤ (selectedYear×10+selectedQuarter) |

---

## 4. As-Is / To-Be

### As-Is

- `GET /api/banks` tự động xác định kỳ qua `detectCurrentPeriod()` — không nhận params
- `GET /api/ranking` tính RANK() trên **toàn bộ** `bctc_new` — không filter kỳ, không nhận params
- `GET /api/banks/:code/trend` trả toàn bộ lịch sử của bank — không nhận params
- Frontend: không có bộ lọc kỳ; `selectedBank` state trong `App.tsx`

### To-Be

- Frontend: bộ lọc kỳ (1 dropdown ghép) tại App.tsx; `selectedPeriod` state shared xuống BankList, RankingChart, và TrendChart
- `GET /api/banks?year=Y&quarter=Q` — Bank List của kỳ (Y, Q)
- `GET /api/ranking?year=Y&quarter=Q` — Ranking của kỳ (Y, Q); RANK() OVER chỉ trên rows của kỳ đó
- `GET /api/banks/:code/trend?year=Y&quarter=Q` — Trend cắt lịch sử tại cutoff (Y, Q): chỉ trả rows có (Year×10+Quarter) ≤ (Y×10+Q)
- `GET /api/periods` (mới) — danh sách kỳ khả dụng
- Backward compat: không có params → cả 3 endpoint giữ nguyên behavior hiện tại

---

## 5. Detailed Specification

### 5.1 Bộ lọc kỳ (UI)

**Vị trí**: Phía trên Bank List trong `App.tsx`, trước section "Danh Sách Ngân Hàng".

**Loại control**: 1 dropdown ghép — mỗi option là 1 kỳ `{ year, quarter }`. Không tách 2 dropdown riêng (tránh tổ hợp invalid).

**Dữ liệu nguồn**: `GET /api/periods` — fetch 1 lần khi load trang.

**Trạng thái mặc định**: Kỳ từ `meta.period` của lần fetch `/api/banks` đầu tiên (không có params). Nếu `meta.period` null → chọn item đầu tiên từ `/api/periods`. Nếu `/api/periods` rỗng → hiển thị "Không có dữ liệu".

**Label option**:
- Quarter=0 → `"{Year} (Năm)"` (ví dụ: `"2023 (Năm)"`)
- Quarter=1–4 → `"Q{Quarter}/{Year}"` (ví dụ: `"Q4/2024"`)

**Hành vi khi chọn**: `selectedPeriod` ở App.tsx cập nhật → trigger re-fetch của cả BankList và RankingChart.

### 5.2 Thay đổi `GET /api/banks`

- Thêm optional query params: `year` (integer) và `quarter` (integer 0–4)
- Khi có cả 2 params → filter `WHERE Year = ? AND Quarter = ?`
- Khi thiếu params → giữ nguyên behavior hiện tại (`detectCurrentPeriod()`)
- Validation: `year` ∈ [1900, 2100], `quarter` ∈ {0, 1, 2, 3, 4}; nếu sai → HTTP 400

### 5.3 Thay đổi `GET /api/ranking`

- Thêm optional query params: `year` (integer) và `quarter` (integer 0–4)
- Khi có cả 2 params → RANK() OVER **chỉ trên rows** có `Year = ? AND Quarter = ?`
- Khi thiếu params → giữ nguyên behavior hiện tại (RANK() trên toàn bộ `bctc_new`)
- Validation: cùng rule như `/api/banks`
- Response format: không đổi (cùng `RankingRow` interface hiện tại)

### 5.4 Endpoint mới `GET /api/periods`

Query:
```sql
SELECT DISTINCT Year, Quarter
FROM bctc_new
ORDER BY Year DESC, Quarter DESC
```

Response:
```json
{
  "data": [
    { "year": 2025, "quarter": 1 },
    { "year": 2024, "quarter": 4 },
    { "year": 2024, "quarter": 0 }
  ]
}
```
Trả về mảng rỗng (không lỗi) nếu `bctc_new` rỗng.

### 5.5 Thay đổi `GET /api/banks/:code/trend`

- Thêm optional query params: `year` (integer) và `quarter` (integer 0–4)
- Khi có cả 2 params → cutoff filter:
  - Annual rows (Quarter=0): trả về rows có `Year ≤ Y`
  - Quarterly rows (Quarter=1–4): trả về rows có `(Year×10+Quarter) ≤ (Y×10+Q)`
  - Đặc biệt khi selected `Q=0` (kỳ năm): quarterly rows filter `Year ≤ Y` (toàn bộ quý của các năm ≤ Y)
- Khi thiếu params → giữ nguyên behavior hiện tại (toàn bộ lịch sử)
- Validation: cùng rule như `/api/banks`; nếu sai → HTTP 400

**Lý do cutoff thay vì filter exact**: Trend chart thể hiện xu hướng theo thời gian. Khi user chọn "Q2/2024", họ muốn thấy lịch sử đến điểm đó — không phải chỉ Q2/2024 đơn lẻ.

### 5.6 State management tại `App.tsx`

- Thêm state: `const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; quarter: number } | null>(null)`
- `selectedPeriod` được set sau khi fetch `/api/banks` lần đầu (dùng `meta.period`)
- Truyền `selectedPeriod` vào `<BankList>`, `<RankingChart>`, và `<TrendChart>`
- Khi `selectedPeriod` thay đổi → cả 3 component re-fetch

---

## 6. Non-Functional Requirements

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| NFR-1 | Thêm `/api/periods` không ảnh hưởng latency của `/api/banks` và `/api/ranking` | Fetch song song hoặc trước |
| NFR-2 | Danh sách kỳ fetch 1 lần khi load trang, không poll | Kỳ mới cần F5 để cập nhật |
| NFR-3 | Thêm filter không làm hỏng bất kỳ hành vi hiện có (Trend không đổi) | Regression test cần thiết |
| NFR-4 | Bộ lọc hoạt động bình thường khi DB chỉ có 1 kỳ | Boundary case |
| NFR-5 | Race condition khi đổi filter nhanh: response cũ không ghi đè response mới | Dùng AbortController ở frontend |

---

## 7. Acceptance Criteria

### Bộ lọc kỳ — Hiển thị

**AC-1**: Khi trang load, dropdown bộ lọc hiển thị danh sách các kỳ thực sự có trong DB (lấy từ `GET /api/periods`), không hardcode.

**AC-2**: Mặc định, dropdown chọn kỳ hiện tại (`meta.period` từ `GET /api/banks` lần đầu). Nếu `meta.period` null → chọn item đầu tiên từ `/api/periods`.

**AC-3**: Mỗi option trong dropdown hiển thị đúng label: Quarter=0 → `"{Year} (Năm)"`, Quarter=1–4 → `"Q{Quarter}/{Year}"`.

### Bộ lọc kỳ — Hành vi khi thay đổi

**AC-4**: Khi người dùng chọn kỳ khác, cả Bank List và Ranking Chart tải lại đồng thời với dữ liệu của kỳ mới.

**AC-5**: Khi đang fetch sau khi đổi filter, hiển thị loading state; dữ liệu kỳ cũ không còn hiển thị trong thời gian chờ.

**AC-6**: Khi (Year, Quarter) được chọn không có dữ liệu, Bank List hiển thị "Không có dữ liệu cho kỳ này"; Ranking Chart hiển thị thông báo tương tự.

### API `/api/periods`

**AC-7**: `GET /api/periods` trả về danh sách `{ year, quarter }` DISTINCT, sắp xếp `Year DESC, Quarter DESC`, chỉ gồm kỳ có ít nhất 1 bản ghi trong `bctc_new`.

**AC-8**: `GET /api/periods` trả về `{ "data": [] }` (HTTP 200, không lỗi) nếu `bctc_new` rỗng.

### API `/api/banks` với params

**AC-9**: `GET /api/banks?year=Y&quarter=Q` trả về Bank List đúng cho kỳ (Y, Q), cùng format response hiện tại.

**AC-10**: `GET /api/banks?year=Y&quarter=Q` với Y hoặc Q không hợp lệ trả về HTTP 400 với `{ "error": "Invalid year or quarter" }`.

**AC-11**: `GET /api/banks` không có params giữ nguyên behavior hiện tại (`detectCurrentPeriod()`).

### API `/api/ranking` với params

**AC-14**: `GET /api/ranking?year=Y&quarter=Q` tính RANK() OVER chỉ trên các rows có `Year=Y AND Quarter=Q` trong `bctc_new`, trả về cùng format response hiện tại.

**AC-15**: `GET /api/ranking?year=Y&quarter=Q` với params không hợp lệ trả về HTTP 400.

**AC-16**: `GET /api/ranking` không có params giữ nguyên behavior hiện tại (RANK() trên toàn bộ `bctc_new`).

### API `/api/banks/:code/trend` với params

**AC-17**: `GET /api/banks/:code/trend?year=Y&quarter=Q` trả về annual rows có `Year ≤ Y` và quarterly rows có `(Year×10+Quarter) ≤ (Y×10+Q)` (khi Q>0); hoặc `Year ≤ Y` cho cả 2 loại khi Q=0.

**AC-18**: `GET /api/banks/:code/trend?year=Y&quarter=Q` với params không hợp lệ trả về HTTP 400.

**AC-19**: `GET /api/banks/:code/trend` không có params giữ nguyên behavior hiện tại (toàn bộ lịch sử).

### Trend chart trên UI

**AC-20**: Khi người dùng chọn kỳ (Y, Q), Trend chart của ngân hàng đang được chọn tải lại và chỉ hiển thị dữ liệu đến cutoff (Y, Q).

**AC-21**: Khi chọn kỳ Q=0 (báo cáo năm), Trend Chart A (annual) hiển thị dữ liệu đến Year=Y; Chart B (quarterly) hiển thị dữ liệu của các quý thuộc các năm ≤ Y.

---

## 8. Examples

### 8.1 Normal Cases

**Normal-1 — Chọn kỳ Q4/2024**

`bctc_new` có Q4/2024 (5 ngân hàng: VCB, TCB, BID, MBB, ACB) và Q1/2025 (3 ngân hàng). Người dùng đang xem Q1/2025 (default), chọn "Q4/2024".

**Kết quả mong đợi**:
- Bank List hiển thị 5 ngân hàng của Q4/2024
- Ranking Chart hiển thị ranking tính trên 5 ngân hàng Q4/2024 (RANK() trên 5 rows)
- Dropdown hiển thị "Q4/2024"
- Nếu VCB đang được chọn: Trend chart tải lại, Chart A hiển thị annual ≤ 2024, Chart B hiển thị quarterly ≤ 2024Q4

---

**Normal-2 — Chọn kỳ năm 2023 (Quarter=0)**

`bctc_new` có Quarter=0, Year=2023 cho 4 ngân hàng.

**Kết quả mong đợi**:
- Bank List hiển thị 4 ngân hàng
- Ranking Chart hiển thị ranking tính trên 4 ngân hàng của kỳ năm 2023
- Dropdown hiển thị "2023 (Năm)"
- Nếu VCB đang được chọn: Trend chart tải lại, Chart A hiển thị annual ≤ 2023, Chart B hiển thị quarterly của các năm ≤ 2023 (tất cả Q1–Q4 của 2022, 2023,…)
- 3 API được gọi: `GET /api/banks?year=2023&quarter=0`, `GET /api/ranking?year=2023&quarter=0`, `GET /api/banks/VCB/trend?year=2023&quarter=0`

---

### 8.2 Abnormal Cases

**Abnormal-1 — Chọn kỳ không có dữ liệu**

Người dùng bằng cách nào đó trigger `year=2020&quarter=2` nhưng không có bản ghi nào.

**Kết quả mong đợi**:
- Cả 2 API trả về `data: []` (HTTP 200)
- Bank List hiển thị "Không có dữ liệu cho kỳ này"
- Ranking Chart hiển thị thông báo tương tự
- Không crash

---

**Abnormal-2 — `bctc_new` rỗng**

`GET /api/periods` → `{ "data": [] }`. Không có kỳ nào.

**Kết quả mong đợi**:
- Dropdown hiển thị "Không có dữ liệu"
- Bank List và Ranking Chart đều hiển thị "Không có dữ liệu"
- Không crash

---

### 8.3 Boundary Values

**Boundary-1 — DB chỉ có 1 kỳ**

`bctc_new` chỉ có Q1/2025.

**Kết quả mong đợi**:
- `GET /api/periods` → 1 phần tử: `[{ "year": 2025, "quarter": 1 }]`
- Dropdown 1 lựa chọn, hoạt động bình thường (không crash, không disabled)
- Ranking: mỗi ngân hàng trong Q1/2025 có RANK=1 cho các metric không NULL

---

**Boundary-2 — Params không hợp lệ**

`GET /api/banks?year=abc&quarter=5` → HTTP 400 `{ "error": "Invalid year or quarter" }`  
`GET /api/ranking?year=1899&quarter=1` → HTTP 400  
`GET /api/ranking?year=2024` (chỉ có year, không có quarter) → HTTP 400 (cả 2 params phải có cùng nhau)

---

**Boundary-3 — Đổi filter nhanh liên tiếp (race condition)**

Người dùng đổi từ Q4/2024 → Q3/2024 → Q2/2024 trong vòng 0.5 giây.

**Kết quả mong đợi**:
- Chỉ response của lần fetch cuối cùng (Q2/2024) được hiển thị
- Response cũ bị cancel (AbortController) hoặc ignore

---

**Boundary-4 — Trend cutoff tại kỳ sớm nhất trong DB**

VCB có dữ liệu từ Q1/2022 đến Q4/2024. User chọn "Q1/2022".

**Kết quả mong đợi**:
- `GET /api/banks/VCB/trend?year=2022&quarter=1` trả về 1 quarterly row (2022Q1) và annual rows có Year×10+0 ≤ 2022×10+1 (tức annual 2022 nếu tồn tại)
- Trend Chart B hiển thị 1 điểm, không có đường nối, không crash

---

## 9. Open Issues

| # | Câu hỏi | Ảnh hưởng | Ưu tiên | Trạng thái |
|---|---------|-----------|---------|------------|
| ~~OI-1~~ | ~~Ranking chart có filter theo kỳ không?~~ **✅ ĐÓNG** — Có. Ranking filter theo kỳ đã chọn. | — | — | CLOSED |
| ~~OI-3~~ | ~~Cho phép Year-only không?~~ **✅ ĐÓNG** — Không. Luôn chọn Year+Quarter cùng nhau. | — | — | CLOSED |
| ~~OI-2~~ | ~~Trend chart có bị ảnh hưởng không?~~ **✅ ĐÓNG** — Có. Trend cắt lịch sử tại cutoff (Year, Quarter) được chọn. | — | — | CLOSED |
| ~~OI-4~~ | ~~1 dropdown ghép hay 2 dropdown riêng?~~ **✅ ĐÓNG (safe default)** — 1 dropdown ghép, vì OI-3 quyết định luôn phải chọn cả Year+Quarter. | — | — | CLOSED |
| OI-5 | Danh sách kỳ có auto-refresh sau khi crawl không? | NFR | P3 — không blocking (F5 là đủ) |
| OI-6 | Notify user khi kỳ mới được crawl? | UX | P3 — không blocking |

---

## 10. Risks

| # | Rủi ro | Khả năng | Ảnh hưởng | Biện pháp |
|---|--------|----------|-----------|-----------|
| R1 | Thêm params vào `/api/banks` và `/api/ranking` có thể gây regression nếu không giữ backward compat | Thấp | Cao | AC-11, AC-16: không có params → giữ behavior cũ |
| R2 | Race condition khi đổi filter nhanh | Thấp | Trung bình | Dùng AbortController trong frontend fetch (AC từ Boundary-3) |
| R3 | Ranking thay đổi từ "cross-period" sang "within-period" — nếu user không hiểu ý nghĩa của ranking trong 1 kỳ có ít ngân hàng (e.g. 2 ngân hàng) | Trung bình | Thấp | Hiển thị số lượng ngân hàng trong kỳ trên Ranking chart |
| R4 | `GET /api/periods` trả thêm nhiều kỳ nếu DB lớn — dropdown quá dài | Thấp | Thấp | Giới hạn hiển thị hoặc nhóm theo năm nếu cần (defer) |

---

## 11. Traceability Table

| AC | Screen/Component | API/Query | DB Table | Log | Permissions | Test Type |
|----|-----------------|-----------|----------|-----|-------------|-----------|
| AC-1 | Dropdown bộ lọc kỳ | GET /api/periods | bctc_new | — | — | IT, E2E |
| AC-2 | Dropdown bộ lọc kỳ (default state) | GET /api/banks (no params) → meta.period | bctc_new | — | — | IT, E2E |
| AC-3 | Dropdown bộ lọc kỳ (label format) | — | — | — | — | UT, BB |
| AC-4 | BankList + RankingChart (cả 2 reload) | GET /api/banks?year=Y&quarter=Q, GET /api/ranking?year=Y&quarter=Q | bctc_new | — | — | IT, E2E |
| AC-5 | BankList + RankingChart (loading state) | — | — | — | — | E2E |
| AC-6 | BankList + RankingChart (empty state) | GET /api/banks?year=Y&quarter=Q → data=[] | bctc_new | — | — | IT, BB |
| AC-7 | — | GET /api/periods (DISTINCT, sorted) | bctc_new | — | — | UT, IT |
| AC-8 | — | GET /api/periods (empty DB) | bctc_new | — | — | IT, BB |
| AC-9 | BankList | GET /api/banks?year=Y&quarter=Q | bctc_new | — | — | IT |
| AC-10 | — | GET /api/banks?year=invalid → 400 | — | — | — | UT, BB |
| AC-11 | BankList (no-params = default period) | GET /api/banks (no params) | bctc_new | — | — | IT |
| AC-14 | RankingChart | GET /api/ranking?year=Y&quarter=Q | bctc_new | — | — | UT, IT |
| AC-17 | — | GET /api/banks/:code/trend?year=Y&quarter=Q (cutoff filter) | bctc_new | — | — | UT, IT |
| AC-18 | — | GET /api/banks/:code/trend?year=invalid → 400 | — | — | — | UT, BB |
| AC-19 | TrendChart (no-params = full history) | GET /api/banks/:code/trend (no params) | bctc_new | — | — | IT |
| AC-20 | TrendChart (reload on filter change) | GET /api/banks/:code/trend?year=Y&quarter=Q | bctc_new | — | — | IT, E2E |
| AC-21 | TrendChart (Q=0 cutoff rule) | GET /api/banks/:code/trend?year=Y&quarter=0 | bctc_new | — | — | IT, BB |
| AC-15 | — | GET /api/ranking?year=invalid → 400 | — | — | — | UT, BB |
| AC-16 | RankingChart (no-params = full dataset) | GET /api/ranking (no params) | bctc_new | — | — | IT |

**Chú thích test type**: UT = Unit Test, IT = Integration Test, E2E = End-to-End, BB = Black-Box / Boundary

---

## 12. Phán định: Có thể bắt đầu implementation chưa?

**→ YES** *(cập nhật 2026-05-09: tất cả 6 Open Issues đã đóng — FINAL)*

### Lý do

Tất cả Open Issues đã được giải quyết:
- OI-1 (Ranking có filter) → **Có** — RANK() within-period
- OI-2 (Trend chart có filter) → **Có** — cutoff tại (Y, Q) được chọn
- OI-3 (Year-only) → **Không** — luôn Year+Quarter cùng nhau
- OI-4 (dropdown design) → **1 dropdown ghép** (safe default từ OI-3)
- OI-5, OI-6 → không blocking, defer sang ticket riêng nếu cần

### Điều kiện trước khi bắt đầu implementation

Không có điều kiện đặc biệt. Spec này đủ để implement ngay.

### Lưu ý quan trọng cho implementation

- **Assumption cần xác nhận**: Trend cutoff khi Q=0 (kỳ năm) áp dụng cho quarterly rows bằng cách filter `Year ≤ Y` (toàn bộ quý của các năm ≤ Y). Nếu ý định khác → báo lại trước khi implement AC-21.
- **Race condition**: AbortController bắt buộc vì 3 fetch fire cùng lúc khi đổi filter.
