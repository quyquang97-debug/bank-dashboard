# Spec Pack — suggest-stock (Tab "Sàng Lọc Cổ Phiếu")

**Version**: 1.0
**Date**: 2026-05-10
**Status**: Final — tất cả Open Issues đã được giải quyết, sẵn sàng implement

---

## 1. Background / Purpose

Bank Dashboard hiện có 2 tab: "Xếp Hạng" (ranking history theo kỳ) và "Định Giá" (valuation snapshot dựa trên MOS). Hai nguồn dữ liệu này độc lập, người dùng phải tự đối chiếu để quyết định mã nào "đáng quan tâm".

Mục tiêu: thêm tab thứ 3 **"🎯 Sàng Lọc"** tự động tổng hợp 2 nguồn này, tính một điểm tổng hợp 0–100 cho mỗi mã thuộc kỳ được chọn, và đưa ra tín hiệu khuyến nghị (MUA / GIỮ / TRÁNH) dựa trên ngưỡng cấu hình.

---

## 2. Scope

### Làm (In Scope)
- Thêm tab thứ 3 "🎯 Sàng Lọc" vào `App.tsx` navigator (song song "Xếp Hạng" + "Định Giá").
- Thêm backend route `GET /api/screening?year=&quarter=` (file mới: `backend/src/routes/screening.ts`).
- Thêm file constant `backend/src/config/screeningConfig.ts` chứa các ngưỡng & cap dùng trong công thức.
- Thêm component `frontend/src/components/ScreeningTab.tsx`:
  - Reuse `<PeriodFilter />` hiện có cho combobox chọn kỳ.
  - Bảng kết quả sort theo Score giảm dần.
  - Footer hiển thị công thức tóm tắt.
- Thêm `fetchScreening(year, quarter)` vào `frontend/src/api/client.ts`.
- Tính toán in-memory mỗi request (không cache, không persist).

### Không làm (Out of Scope)
- Không thêm DB table mới.
- Không sửa logic của tab "Xếp Hạng" và "Định Giá" hiện có.
- Không gọi external AI/LLM API.
- Không có authentication / phân quyền.
- Không filter / search / pagination trong bảng kết quả Sàng Lọc.
- Không lưu lịch sử kết quả Sàng Lọc.
- Không cho phép user tùy chỉnh trọng số 0.5 / 0.5 trên UI (cố định trong code).

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| `totalDiem_i` | Tổng điểm xếp hạng của mã `i` tại kỳ được chọn (lấy từ `/api/ranking/history`, filter theo `year` + `quarter`) |
| `ti_i` | `ti_suat_sinh_loi` của mã `i` từ `/api/valuation` (snapshot mới nhất, không phụ thuộc kỳ) — bằng `(MOS - current_price) / current_price` |
| `ti_capped(i)` | `clamp(ti_i, -0.5, +0.5)` — chặn `ti_i` trong khoảng `[-TI_CAP, +TI_CAP]` |
| `S_rank(i)` | Điểm xếp hạng đã chuẩn hoá về thang 0–100 |
| `S_val(i)` | Điểm định giá đã chuẩn hoá về thang 0–100 |
| `Score(i)` | Điểm tổng hợp 0–100, trung bình có trọng số 50/50 của `S_rank` và `S_val` |
| `signal` | Một trong `"MUA"`, `"GIỮ"`, `"TRÁNH"` — quyết định bởi `Score` và 2 threshold |
| Kỳ (period) | Cặp `(year, quarter)` — `quarter ∈ {1,2,3,4}` cho từng quý, `quarter = 0` cho cả năm (đồng convention với `/api/periods`) |
| Tab "Sàng Lọc" | Tab mới được spec trong tài liệu này |
| `MUA_THRESHOLD` | Ngưỡng `Score` để gắn signal `"MUA"` (default 65) |
| `GIU_THRESHOLD` | Ngưỡng `Score` để gắn signal `"GIỮ"` (default 40) |
| `TI_CAP` | Cap tuyệt đối của `ti_i` trước khi normalize (default 0.5) |
| `S_RANK_NEUTRAL` | Giá trị `S_rank` được gán khi `max == min` (default 50) |

---

## 4. As-Is / To-Be

### As-Is
- `App.tsx` có 2 tab: `"ranking" | "valuation"`.
- Người dùng tự đối chiếu giữa 2 tab để đánh giá mã.
- Không có khái niệm "điểm tổng hợp" hay "tín hiệu khuyến nghị".

### To-Be
```
App.tsx
├── Tab "Xếp Hạng"        (giữ nguyên — không sửa)
├── Tab "Định Giá"        (giữ nguyên — không sửa)
└── Tab "🎯 Sàng Lọc"     (MỚI)
    ├── <PeriodFilter />  ở đầu tab
    ├── [Loading]   "Đang tính toán..."
    ├── [Empty]     "Không có dữ liệu cho kỳ này"
    ├── [Error]     "Lỗi tải dữ liệu, vui lòng thử lại"
    └── [Result]    Bảng — sort theo Score DESC, secondary StockCode ASC
                    Cột: Mã CK | Điểm XH | Điểm Định Giá | Điểm Tổng Hợp | Tín hiệu
                    Row coloring theo signal:
                      MUA   → nền xanh nhạt #e6f4ea
                      GIỮ   → nền vàng nhạt #fff8e1
                      TRÁNH → nền đỏ nhạt  #fce8e6
                    Footer: chú thích công thức ngắn gọn
```

Backend route mới:
- `GET /api/screening?year=<int>&quarter=<int>` — trả `{ period, data: [...], computed_at }`

Lưu ý quan trọng (carry-over từ S1):
> Valuation chỉ có snapshot mới nhất, không theo kỳ. Khi user đổi kỳ trên combobox, **chỉ `s_rank` thay đổi** (vì lấy `totalDiem` theo kỳ mới); `s_val` giữ nguyên (vì `ti_i` không phụ thuộc kỳ). Đây là giới hạn được chấp nhận trong phase này.

---

## 5. Detailed Specification

### 5.1 Constants — `backend/src/config/screeningConfig.ts` (file mới)

File này tập trung tất cả tham số "có thể tinh chỉnh" của thuật toán Sàng Lọc, để khi người dùng muốn đổi ngưỡng / trọng số chỉ phải sửa một chỗ.

Nội dung tối thiểu:
- `MUA_THRESHOLD = 65` (number) — `Score >= MUA_THRESHOLD` → signal `"MUA"`
- `GIU_THRESHOLD = 40` (number) — `GIU_THRESHOLD <= Score < MUA_THRESHOLD` → signal `"GIỮ"`; `Score < GIU_THRESHOLD` → `"TRÁNH"`
- `TI_CAP = 0.5` (number) — dùng để `clamp(ti_i, -TI_CAP, +TI_CAP)`
- `S_RANK_NEUTRAL = 50` (number) — fallback `S_rank` khi `max_all == min_all`
- `WEIGHT_RANK = 0.5` (number) — trọng số `S_rank` trong `Score`
- `WEIGHT_VAL = 0.5` (number) — trọng số `S_val` trong `Score`. Bất biến: `WEIGHT_RANK + WEIGHT_VAL = 1`.

Yêu cầu:
- Phải là TypeScript module export `const` (named export, không default export) để dễ refactor.
- Route `screening.ts` chỉ được dùng các giá trị qua import từ file này — không hardcode lại bất cứ ngưỡng nào.
- File này không có side effect (chỉ export const).

### 5.2 Backend — `GET /api/screening?year=<int>&quarter=<int>`

#### 5.2.1 Validation đầu vào
- `year`, `quarter` là **bắt buộc**, kiểu integer.
- `year`: integer dương, không giới hạn cứng (route hiện có không enforce).
- `quarter`: integer trong `{0, 1, 2, 3, 4}` (0 = cả năm).
- Thiếu hoặc sai kiểu / sai giá trị → `400 { error: "<message>" }`. Ví dụ:
  - Thiếu `year` → `400 { error: "year is required" }`
  - `quarter = 5` → `400 { error: "quarter must be one of 0,1,2,3,4" }`

#### 5.2.2 Pipeline tính toán

Bước 1 — Lấy ranking cho kỳ đã chọn:
- Gọi cùng nguồn dữ liệu mà `/api/ranking/history` đang dùng.
- Filter `WHERE year = :year AND quarter = :quarter`.
- Kết quả: `Map<stockCode, totalDiem>`.

Bước 2 — Lấy valuation snapshot:
- Gọi cùng nguồn mà `/api/valuation` đang dùng (`SELECT StockCode, MOS, current_price, ti_suat_sinh_loi FROM paybacktime`).
- Kết quả: `Map<StockCode, { MOS, current_price, ti_suat_sinh_loi }>`.

Bước 3 — Lọc tập mã (OI-2 closed):
- Tập mã đầu vào của tính toán = **giao** của (mã có trong ranking kỳ chọn) ∩ (mã có valuation với `ti_suat_sinh_loi` không null).
- Mã chỉ có ranking nhưng không có valuation → **loại** khỏi response.
- Mã có valuation nhưng không có ranking ở kỳ chọn → **loại** (đương nhiên, vì là feature theo kỳ).

Bước 4 — Chuẩn hoá `S_rank` (OI-1 closed):
- `min_all = min(totalDiem_i)`, `max_all = max(totalDiem_i)` trên tập mã sau Bước 3.
- Nếu `max_all == min_all` (bao gồm trường hợp tập chỉ có 1 mã, hoặc mọi mã có `totalDiem` bằng nhau): gán `S_rank(i) = S_RANK_NEUTRAL` (= 50) cho mọi `i`. Lý do: không có signal phân biệt giữa các mã, gán giá trị trung tính của thang 0–100 để không bias `Score`.
- Ngược lại: `S_rank(i) = (totalDiem_i - min_all) / (max_all - min_all) * 100`.

Bước 5 — Chuẩn hoá `S_val`:
- `ti_capped(i) = clamp(ti_i, -TI_CAP, +TI_CAP)`.
- `S_val(i) = (ti_capped(i) + TI_CAP) / (2 * TI_CAP) * 100` (tương đương `(ti_capped + 0.5) / 1.0 × 100` khi `TI_CAP = 0.5`).

Bước 6 — Score:
- `Score(i) = WEIGHT_RANK * S_rank(i) + WEIGHT_VAL * S_val(i)`.

Bước 7 — Signal:
- `Score >= MUA_THRESHOLD` → `"MUA"`
- `GIU_THRESHOLD <= Score < MUA_THRESHOLD` → `"GIỮ"`
- `Score < GIU_THRESHOLD` → `"TRÁNH"`

Bước 8 — Sort & format:
- Sort: primary `Score` DESC, secondary `stockCode` ASC (đảm bảo deterministic).
- `s_rank`, `s_val`, `score` làm tròn 2 chữ số thập phân ở tầng API response.
- `totalDiem`, `ti_suat_sinh_loi`, `current_price`, `MOS` giữ raw (không làm tròn).

#### 5.2.3 Response shape

Success (HTTP 200):
```json
{
  "period": { "year": 2025, "quarter": 0 },
  "data": [
    {
      "stockCode": "VCB",
      "s_rank": 87.50,
      "s_val": 72.00,
      "score": 79.75,
      "signal": "MUA",
      "totalDiem": 42,
      "ti_suat_sinh_loi": 0.22,
      "current_price": 85.5,
      "MOS": 104.31
    }
  ],
  "computed_at": "2026-05-10T14:32:01.000Z"
}
```

- `data` là mảng (rỗng hợp lệ).
- `computed_at` là ISO 8601 timestamp (UTC) của thời điểm route handler hoàn thành tính toán.
- `period.year` và `period.quarter` echo lại đúng giá trị từ query string (sau khi đã coerce sang integer).

Error (HTTP 400):
```json
{ "error": "<message>" }
```

Error (HTTP 500): khi DB lỗi hoặc exception ngoài dự kiến.
```json
{ "error": "internal_error" }
```

#### 5.2.4 Đăng ký router
- Trong `backend/src/index.ts`: thêm `app.use("/api/screening", screeningRouter)`.
- Không sửa các `app.use(...)` hiện có.

### 5.3 Frontend — `frontend/src/api/client.ts`

Thêm hàm:
```ts
export async function fetchScreening(year: number, quarter: number): Promise<ScreeningResponse>
```
- Gọi `GET /api/screening?year=${year}&quarter=${quarter}`.
- Throw error nếu HTTP status không phải 2xx (giống các fetcher hiện có trong file).
- Định nghĩa kiểu `ScreeningResponse` và `ScreeningRow` tương ứng response shape ở §5.2.3.

### 5.4 Frontend — `frontend/src/components/ScreeningTab.tsx` (file mới)

Layout (top-down):
1. **Header**: tiêu đề "🎯 Sàng Lọc Cổ Phiếu".
2. **PeriodFilter**: reuse `<PeriodFilter />`. Khi mount, gọi `fetchPeriods()` lấy danh sách kỳ; mặc định chọn kỳ đầu tiên (kỳ mới nhất).
3. **Trạng thái nội dung** (mutually exclusive):
   - Loading → text "Đang tính toán...".
   - Lỗi fetch (HTTP error / network) → text "Lỗi tải dữ liệu, vui lòng thử lại".
   - `data.length === 0` → text "Không có dữ liệu cho kỳ này".
   - Có data → render bảng.
4. **Bảng kết quả**:
   - Cột: `Mã CK` | `Điểm XH` | `Điểm Định Giá` | `Điểm Tổng Hợp` | `Tín hiệu`.
   - Mỗi row có `style.backgroundColor` theo `signal`:
     - `"MUA"` → `#e6f4ea`
     - `"GIỮ"` → `#fff8e1`
     - `"TRÁNH"` → `#fce8e6`
   - Format hiển thị (frontend, OI-7 → đã spec):
     - `s_rank`, `s_val`, `score`: số 2 chữ số thập phân (vd `87.50`).
     - `signal`: text như API trả (không transform).
5. **Footer**: chú thích công thức ngắn, ví dụ:
   ```
   Score = 0.5 × Điểm XH (chuẩn hoá 0–100) + 0.5 × Điểm Định Giá (chuẩn hoá 0–100).
   Tín hiệu: Score ≥ 65 → MUA;  40 ≤ Score < 65 → GIỮ;  Score < 40 → TRÁNH.
   ```
   Lưu ý: text này có thể desync khi backend thay đổi threshold trong `screeningConfig.ts` — xem Risk R-2.

Behavior:
- Khi component mount: `fetchPeriods()` → set kỳ default → `fetchScreening(year, quarter)`.
- Khi user đổi kỳ trên combobox → re-fetch `fetchScreening` với kỳ mới, render lại bảng. Trong khi đợi: hiển thị Loading state (giữ hoặc xoá bảng cũ — spec hoá: **xoá bảng cũ**, hiển thị Loading để không gây nhầm lẫn).
- Khi user switch tab đi và quay lại: re-mount component (không persist state) → flow như mount lần đầu.

### 5.5 Frontend — `frontend/src/App.tsx`

- Mở rộng kiểu `activeTab`: `"ranking" | "valuation" | "screening"`.
- Thêm tab button thứ 3 với label `"🎯 Sàng Lọc"`.
- Khi `activeTab === "screening"` → render `<ScreeningTab />`.
- Không sửa logic 2 tab cũ; mặc định `activeTab = "ranking"` giữ nguyên.

---

## 6. Non-Functional Requirements

| ID | Yêu cầu |
|----|---------|
| NFR-1 | Tất cả ngưỡng / trọng số / cap nằm trong `backend/src/config/screeningConfig.ts`. Không hardcode trong route handler. |
| NFR-2 | Tính toán hoàn toàn in-memory — không tạo DB table mới, không cache, không persist. |
| NFR-3 | API public, không auth (đồng nhất với các route hiện tại). |
| NFR-4 | `/api/screening` là synchronous read-only — không có side effect, không trigger background job. |
| NFR-5 | Sort kết quả phải deterministic (primary `score` DESC, secondary `stockCode` ASC) để E2E test có thể so sánh thứ tự ổn định. |
| NFR-6 | Response size dự kiến ≤ 50 mã (hệ thống hiện 17 ngân hàng + dư địa) — không cần streaming / pagination trong phase này. |
| NFR-7 | Không gọi external AI / LLM API. |
| NFR-8 | Không sửa file nào trong `frontend/src/components/` ngoài việc tạo `ScreeningTab.tsx` mới (trừ `App.tsx` cho tab navigator). Không sửa các route backend hiện có. |

---

## 7. Acceptance Criteria

| ID | Điều kiện kiểm thử | Pass khi |
|----|-------------------|----------|
| AC-1 | `App.tsx` hiển thị 3 tab theo thứ tự "Xếp Hạng" → "Định Giá" → "🎯 Sàng Lọc"; mặc định "Xếp Hạng" active khi load trang | Đếm đúng 3 tab button; tab đầu active; nội dung tab "Xếp Hạng" hiển thị |
| AC-2 | Click tab "🎯 Sàng Lọc" → `<ScreeningTab />` được mount, hiển thị PeriodFilter + state loading/empty/error/result | Component render; chỉ một tab content visible |
| AC-3 | Khi `ScreeningTab` mount lần đầu, kỳ được chọn mặc định là phần tử đầu tiên trả về từ `fetchPeriods()` | Combobox value khớp `periods[0]` |
| AC-4 | Đổi kỳ trên combobox → `fetchScreening(year, quarter)` mới được gọi với đúng tham số; bảng render lại theo data mới | Network log đúng query string; số hàng / nội dung bảng cập nhật |
| AC-5 | `GET /api/screening?year=2025&quarter=0` (giả sử có data) trả 200 với body chứa `period`, `data`, `computed_at`; `period` echo đúng `{ year: 2025, quarter: 0 }` | Response shape đúng §5.2.3 |
| AC-6 | `GET /api/screening` thiếu `year` hoặc `quarter` → trả 400 `{ error: ... }` | Status = 400; body có field `error` |
| AC-7 | `GET /api/screening?year=2025&quarter=5` → trả 400 `{ error: ... }` | Validation đúng range |
| AC-8 | Mã có trong ranking kỳ chọn nhưng không có trong valuation (hoặc `ti_suat_sinh_loi` null) → **không xuất hiện** trong `data` | Mã đó vắng mặt; số phần tử `data` bằng số mã giao của 2 tập |
| AC-9 | Khi `max_all == min_all` (chỉ 1 mã hoặc tất cả `totalDiem` bằng nhau), mọi `s_rank = 50.00` | Tất cả phần tử có `s_rank == 50.00`; không có `NaN` / `Infinity` |
| AC-10 | `ti_i = +0.7` (vượt cap) → `ti_capped = 0.5` → `s_val = 100.00`; `ti_i = -0.7` → `s_val = 0.00`; `ti_i = 0` → `s_val = 50.00` | 3 case test đúng giá trị |
| AC-11 | `Score = 0.5 * S_rank + 0.5 * S_val`, làm tròn 2 chữ số thập phân ở response | Tính tay khớp ±0.01 |
| AC-12 | `Score = 65.00` → signal `"MUA"`; `Score = 64.99` → signal `"GIỮ"`; `Score = 40.00` → `"GIỮ"`; `Score = 39.99` → `"TRÁNH"` (biên dùng `>=`) | 4 case biên đúng |
| AC-13 | `data` được sort `score` DESC, tie-break theo `stockCode` ASC | Với 2 phần tử cùng `score`, `stockCode` đứng trước alphabet hơn xuất hiện trước |
| AC-14 | Bảng frontend tô nền theo `signal`: MUA xanh `#e6f4ea`, GIỮ vàng `#fff8e1`, TRÁNH đỏ `#fce8e6` | Inspect DOM: `style.backgroundColor` đúng từng row |
| AC-15 | Khi `data` rỗng (giao của 2 tập rỗng, hoặc kỳ không có ranking) → API vẫn trả 200 với `data: []`; frontend hiển thị "Không có dữ liệu cho kỳ này" | Status 200, mảng rỗng; UI không crash |
| AC-16 | Sửa `MUA_THRESHOLD` trong `backend/src/config/screeningConfig.ts` từ 65 → 70, restart backend → cùng input data, mã có `Score = 67` chuyển từ `"MUA"` sang `"GIỮ"` | Hành vi route phụ thuộc constant; không chỗ nào hardcode `65` ngoài file constant |
| AC-17 | Tab "Xếp Hạng" và "Định Giá" hoạt động không thay đổi sau khi thêm tab "Sàng Lọc" (không regression) | Mọi AC của 2 tab cũ vẫn pass |
| AC-18 | DB / backend lỗi khi handler đang chạy → trả 500; frontend hiển thị "Lỗi tải dữ liệu, vui lòng thử lại"; không crash | Status 500; UI graceful |

---

## 8. Examples

### Normal Cases

**N-1**: Kỳ có data đầy đủ, tất cả mã có cả ranking lẫn valuation

- Pre-condition: kỳ `(2025, 0)` có 17 mã trong ranking; cả 17 mã có valuation với `ti_suat_sinh_loi` không null.
- Action: User mở tab "Sàng Lọc" → mặc định chọn kỳ `(2025, 0)`.
- Expected:
  - API trả 200, `data` có 17 phần tử, sort `score` DESC.
  - Bảng hiển thị 17 hàng. Hàng đầu có `score` cao nhất, ví dụ `VCB | 87.50 | 72.00 | 79.75 | MUA` (nền xanh).
  - Mã có `score = 50` hiển thị nền vàng (GIỮ).
  - `computed_at` xấp xỉ thời điểm hiện tại.

**N-2**: User đổi kỳ từ `(2025, 0)` sang `(2025, 1)`

- Action: Click combobox → chọn `Q1/2025`.
- Expected:
  - Bảng cũ biến mất, hiển thị "Đang tính toán...".
  - `fetchScreening(2025, 1)` được gọi.
  - Bảng mới render với data của Q1/2025. Lưu ý: cột "Điểm Định Giá" có thể giống hệt N-1 (vì valuation snapshot không phụ thuộc kỳ); chỉ "Điểm XH" và "Điểm Tổng Hợp" thay đổi.

### Abnormal Cases

**A-1**: Tham số sai

- Action: Gọi `GET /api/screening?year=abc&quarter=0`.
- Expected: 400 `{ error: "year must be an integer" }` (hoặc message tương đương). Frontend (nếu xảy ra) hiển thị "Lỗi tải dữ liệu, vui lòng thử lại".

**A-2**: Kỳ chọn không có ranking nào (vd kỳ tương lai chưa có dữ liệu)

- Pre-condition: `(2099, 0)` không có row nào trong ranking history.
- Expected: API trả 200 `{ period: { year: 2099, quarter: 0 }, data: [], computed_at: ... }`. Frontend hiển thị "Không có dữ liệu cho kỳ này".

**A-3**: Tất cả mã trong ranking kỳ chọn đều không có valuation (hoặc `ti_suat_sinh_loi` null)

- Pre-condition: kỳ `(2020, 0)` có 17 mã ranking nhưng bảng `paybacktime` rỗng.
- Expected: Sau Bước 3 (lọc giao), tập mã còn 0 → `data: []`. Frontend hiển thị "Không có dữ liệu cho kỳ này". Không có chia 0, không có exception.

**A-4**: Backend lỗi DB giữa pipeline

- Pre-condition: MySQL drop kết nối khi route đang query.
- Expected: API trả 500 `{ error: "internal_error" }`. Frontend hiển thị thông báo lỗi, không crash, không render bảng rỗng mà không báo.

### Boundary Cases

**B-1**: Chỉ 1 mã thoả mãn (giao chỉ có 1 phần tử) → `max_all == min_all`

- Pre-condition: kỳ `(2025, 1)` chỉ có mã `VCB` trong ranking và `VCB` có valuation.
- Expected: `data` có 1 phần tử với `s_rank = 50.00` (fallback `S_RANK_NEUTRAL`); `s_val` tính bình thường; `score = 0.5*50 + 0.5*s_val`. Không có `NaN`.

**B-2**: Tất cả mã có `totalDiem` bằng nhau

- Pre-condition: 17 mã, tất cả `totalDiem = 30`.
- Expected: tất cả `s_rank = 50.00`; thứ tự sort phụ thuộc `score` (do `s_val` khác nhau), tie-break theo `stockCode` ASC khi `score` bằng nhau.

**B-3**: `ti_i` chạm cap dương / âm / không giới hạn

- Case dương: `ti_i = +0.5` → `ti_capped = 0.5` → `s_val = 100.00`.
- Case dương vượt cap: `ti_i = +1.2` → `ti_capped = 0.5` → `s_val = 100.00` (không bonus thêm vì đã cap).
- Case âm: `ti_i = -0.5` → `s_val = 0.00`.
- Case âm vượt cap: `ti_i = -2.0` → `s_val = 0.00`.
- Case zero: `ti_i = 0` → `s_val = 50.00`.

**B-4**: Score rơi đúng ngưỡng

- `Score = 65.00` → `"MUA"` (dùng `>=`).
- `Score = 64.99` → `"GIỮ"`.
- `Score = 40.00` → `"GIỮ"` (dùng `>=` cho biên dưới của GIỮ).
- `Score = 39.99` → `"TRÁNH"`.

**B-5**: Tie trên `score`

- Pre-condition: `ACB` và `BID` đều có `score = 70.00`.
- Expected: `ACB` xuất hiện trước `BID` (alphabet ASC).

**B-6**: `quarter = 0` (cả năm) vs `quarter = 1..4`

- Cả 2 đều hợp lệ (đồng convention với `/api/periods`). Pipeline filter ranking dùng đúng `WHERE year = :year AND quarter = :quarter` — không có logic đặc biệt cho `quarter = 0` (đã được tầng dưới xử lý đồng nhất với route `/api/ranking/history`).

---

## 9. Open Issues

| ID | Câu hỏi | Quyết định | Status |
|----|---------|-----------|--------|
| OI-1 | Khi `max_all == min_all` (chia 0 trong `S_rank`) — fallback thế nào? | Gán `S_rank = S_RANK_NEUTRAL` (= 50) cho mọi mã. Lý do: không có signal phân biệt → giá trị trung tính của thang 0–100, không bias `Score` lên/xuống. | **CLOSED** (decided in Phase 1) |
| OI-2 | Mã có ranking nhưng không có valuation (`ti_i` null) — giữ với `S_val=null`, hay loại? | **Loại khỏi kết quả.** Tập mã trả về = ranking_kỳ ∩ valuation_có_ti_không_null. | **CLOSED** (per user) |
| OI-3 | "Kỳ mặc định mới nhất" được xác định thế nào? | Dùng phần tử đầu tiên của `fetchPeriods()` (route `/api/periods` đã sort DESC theo `(year, quarter)`). | **CLOSED** (spec hóa từ S5) |
| OI-4 | Threshold `65` / `40` cứng trong code? | Tách vào file constant `backend/src/config/screeningConfig.ts` chứa `MUA_THRESHOLD`, `GIU_THRESHOLD`, `TI_CAP`, `S_RANK_NEUTRAL`, `WEIGHT_RANK`, `WEIGHT_VAL`. Route phải import từ file này. | **CLOSED** (per user) |
| OI-5 | Schema cột `totalDiem` (INT vs DECIMAL) ảnh hưởng precision của normalization. Memory note đã flag chủ đề này. | `totalDiem` là **INT** (confirmed). Normalization `S_rank = (x - min) / (max - min) * 100` vẫn dùng floating-point arithmetic ở runtime (TypeScript/JavaScript) — không có precision loss. Nếu nhiều mã có `totalDiem` sát nhau, `S_rank` phân tách kém, nhưng đây là behaviour đúng (data quyết định, không phải bug). Accept as-is. | **CLOSED** (per user) |
| OI-6 | Tie-breaker khi `score` bằng nhau? | Secondary sort theo `stockCode` ASC để deterministic (NFR-5). | **CLOSED** (spec hóa) |
| OI-7 | Format hiển thị `s_rank` / `s_val` / `score`? | 2 chữ số thập phân, làm tròn ở tầng API response (frontend chỉ render). | **CLOSED** (spec hóa, đồng nhất `paybacktime-estimate`) |
| OI-8 | Auth / permission cho `/api/screening`? | Public, không auth — đồng convention với các route hiện tại. | **CLOSED** (NFR-3) |
| OI-9 | Hiển thị empty / loading / error UI text — chính xác câu chữ? | Đã spec hóa trong §5.4: "Đang tính toán...", "Không có dữ liệu cho kỳ này", "Lỗi tải dữ liệu, vui lòng thử lại". Có thể tinh chỉnh khi UX review nhưng không chặn impl. | **CLOSED** (có thể revisit) |

---

## 10. Risks

| ID | Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|----|--------|----------|-----------|-----------|
| R-1 | Valuation snapshot không theo kỳ → khi user đổi kỳ, `s_val` không đổi → có thể gây hiểu nhầm "score thay đổi tuỳ tiện" | Cao | Trung bình | Footer ghi rõ công thức + giới hạn; documented trong §4 As-Is/To-Be. Phase sau: bổ sung historical valuation. |
| R-2 | Threshold trong `screeningConfig.ts` (backend) lệch với text hiển thị footer ở `ScreeningTab.tsx` (frontend hardcode) → user thấy footer nói "65" nhưng thực tế cutoff là 70 | Trung bình | Trung bình | (a) PR review checklist: khi đổi `screeningConfig.ts` phải sửa footer text. (b) Phase sau: đưa thresholds vào response API và để frontend render text từ đó. |
| R-3 | `totalDiem` schema INT (OI-5) khiến `S_rank` rơi vào ít bucket → score discriminative kém | Thấp | Thấp | Verify schema trước impl; nếu cần, đề xuất migrate sang DECIMAL ở phase riêng. |
| R-4 | Loại mã không có valuation (OI-2) khiến tab Sàng Lọc trả ít mã hơn tab "Xếp Hạng" cùng kỳ → user thắc mắc | Trung bình | Thấp | Footer / tooltip giải thích "chỉ hiển thị mã có cả ranking và valuation". (Có thể bổ sung text này trong phase impl.) |
| R-5 | Performance: tính toán O(N) với N ≤ 50 mã — không là vấn đề. Nhưng nếu tương lai mở rộng nhiều mã → cần xem xét cache. | Thấp | Thấp | Phase này không cần xử lý. Documented in NFR-6. |

---

## 11. Traceability Table

| AC | Screen / Component | API | DB | Config / Constant | Test Type |
|----|-------------------|-----|-----|-------------------|-----------|
| AC-1 | `App.tsx` — 3 tab navigator | — | — | — | E2E |
| AC-2 | `App.tsx` + `ScreeningTab.tsx` mount | — | — | — | E2E |
| AC-3 | `ScreeningTab` — default period | `GET /api/periods` | — | — | E2E / IT |
| AC-4 | `ScreeningTab` — combobox change | `GET /api/screening` | — | — | E2E / IT |
| AC-5 | — | `GET /api/screening` (success) | `ranking_*`, `paybacktime` | — | IT |
| AC-6 | — | `GET /api/screening` (missing param) | — | — | IT / UT (validator) |
| AC-7 | — | `GET /api/screening` (invalid quarter) | — | — | IT / UT (validator) |
| AC-8 | — | `GET /api/screening` (filter logic) | `ranking_*` ∩ `paybacktime` | — | IT / UT (pipeline) |
| AC-9 | — | `GET /api/screening` (max==min) | — | `S_RANK_NEUTRAL` | UT (normalize fn) |
| AC-10 | — | `GET /api/screening` (cap clamp) | — | `TI_CAP` | UT (normalize fn) |
| AC-11 | — | `GET /api/screening` (score formula) | — | `WEIGHT_RANK`, `WEIGHT_VAL` | UT |
| AC-12 | — | `GET /api/screening` (signal boundary) | — | `MUA_THRESHOLD`, `GIU_THRESHOLD` | UT (signal fn) |
| AC-13 | `ScreeningTab` — bảng order | `GET /api/screening` (sort) | — | — | IT / BB |
| AC-14 | `ScreeningTab` — row coloring | — | — | — | E2E / BB |
| AC-15 | `ScreeningTab` — empty state | `GET /api/screening` (data:[]) | — | — | E2E / IT |
| AC-16 | — | `GET /api/screening` (threshold change) | — | `MUA_THRESHOLD` (mutate test) | IT |
| AC-17 | `App.tsx` + tab "Xếp Hạng" + tab "Định Giá" | (existing) | (existing) | — | E2E (regression) |
| AC-18 | `ScreeningTab` — error state | `GET /api/screening` (5xx) | — | — | IT / E2E |

---

## 12. Phán định: Có thể bắt đầu implementation chưa?

**Yes — sẵn sàng implement toàn bộ.**

Tất cả 9 Open Issues đã được giải quyết:
- OI-1, OI-2, OI-4: quyết định bởi user trong Phase 1.
- OI-3, OI-6, OI-7, OI-8, OI-9: đóng bằng quyết định mặc định hợp lý có căn cứ.
- OI-5: `totalDiem` xác nhận là INT; arithmetic normalization dùng floating-point ở runtime, không có precision loss; accept as-is.

Spec đủ chi tiết để bắt đầu implementation theo thứ tự sau:

1. `backend/src/config/screeningConfig.ts` — constants file
2. `backend/src/routes/screening.ts` — route handler (validation + pipeline)
3. `backend/src/index.ts` — đăng ký router
4. `frontend/src/api/client.ts` — thêm `fetchScreening`
5. `frontend/src/components/ScreeningTab.tsx` — UI component
6. `frontend/src/App.tsx` — thêm tab thứ 3
