# Spec Pack — paybacktime (Tab "Định Giá")

**Version**: 1.1  
**Date**: 2026-05-10  
**Status**: Final — tất cả Open Issues đã được giải quyết, sẵn sàng implement

---

## 1. Background / Purpose

Web dashboard hiện tại (Phase 2) hiển thị dữ liệu tài chính ngân hàng dạng scroll (BankList, TrendChart, RankingChart). Folder `/paybacktime` đã có logic tính MOS (Margin of Safety) độc lập, chạy bằng CLI (`npm run paybacktime`), lưu kết quả vào bảng MySQL `paybacktime`.

Mục tiêu: tích hợp kết quả định giá vào dashboard bằng cách thêm tab "Định Giá", cho phép người dùng trigger tính toán và xem kết quả trực tiếp trên giao diện web.

---

## 2. Scope

### Làm (In Scope)
- Chuyển layout `App.tsx` từ scroll sang **tab navigator** với 2 tab: "Xếp Hạng" và "Định Giá".
- Tab "Xếp Hạng": giữ nguyên toàn bộ nội dung hiện tại (BankList, TrendChart, RankingChart, PeriodFilter).
- Tab "Định Giá": trigger tính MOS qua API và hiển thị kết quả dạng bảng.
- Thêm 2 backend route mới trong file `backend/src/routes/valuation.ts`.
- Dùng bảng `paybacktime` (8 năm), danh sách 17 ngân hàng hardcode như trong `PayBacktime.ts`.

### Không làm (Out of Scope)
- Tab "6 năm" hoặc bất kỳ biến thể nào khác của paybacktime.
- Thay đổi bất kỳ file nào trong folder `/paybacktime`.
- Authentication, phân quyền.
- Caching kết quả tính MOS phía backend.
- Lọc, tìm kiếm, phân trang trong bảng kết quả Định Giá.

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| MOS | Margin of Safety — giá trị nội tại ước tính của cổ phiếu, đơn vị nghìn đồng/cổ phiếu |
| `current_price` | Giá giao dịch hiện tại lấy từ `GetTradeInfo`, đơn vị nghìn đồng/cổ phiếu |
| `ti_suat_sinh_loi` | `MOS / current_price` — tỉ lệ giữa giá trị nội tại và giá thị trường; lưu dưới dạng số thực (không nhân 100) |
| Tab "Xếp Hạng" | Tab chứa toàn bộ nội dung hiện tại của dashboard |
| Tab "Định Giá" | Tab mới hiển thị kết quả tính MOS |
| `runPaybacktime` | Hàm export từ `paybacktime/runPaybacktime.ts`, nhận `stockCodes`, `calMosFn`, `numberOfYear` |

---

## 4. As-Is / To-Be

### As-Is
- Layout: một trang scroll duy nhất — BankList → TrendChart → RankingChart.
- Logic tính MOS: chỉ chạy được qua CLI (`npx tsx paybacktime/PayBacktime.ts`).
- Kết quả MOS trong DB nhưng không hiển thị trên web.

### To-Be
```
App.tsx
├── Tab "Xếp Hạng" (tab mặc định khi load trang)
│   ├── PeriodFilter
│   ├── BankList
│   ├── TrendChart
│   └── RankingChart
└── Tab "Định Giá"
    ├── [Loading state]  Overlay text trong vùng lưới: "Đang tính toán định giá..."
    ├── [Concurrent]     Overlay text trong vùng lưới: "Đang có phiên tính toán khác đang chạy..."
    ├── [Timeout/Error]  Overlay text trong vùng lưới: "Tính toán quá thời gian (10s), vui lòng thử lại"
    └── [Result state]   Bảng ValuationTable — sắp xếp ti_suat_sinh_loi DESC
                         Hàng dương: nền xanh nhạt (#e6f4ea)
                         Hàng âm:    nền đỏ nhạt (#fce8e6)
                         Hàng = 0:   nền mặc định
```

Backend routes mới:
- `POST /api/valuation/run` — chạy `runPaybacktime`, đợi xong trả `{ success: true }`
- `GET /api/valuation` — query bảng `paybacktime`, trả về tất cả rows sắp xếp `ti_suat_sinh_loi DESC`

---

## 5. Detailed Specification

### 5.1 Frontend — Tab Navigator

- `App.tsx` thêm state `activeTab: "ranking" | "valuation"`, mặc định `"ranking"`.
- Render 2 tab button. Click tab → cập nhật `activeTab`.
- Khi `activeTab === "ranking"`: render nội dung hiện tại (PeriodFilter, BankList, TrendChart, RankingChart).
- Khi `activeTab === "valuation"`: mount component `ValuationTab` và trigger flow bên dưới.

### 5.2 Frontend — Tab "Định Giá" (ValuationTab)

**Trigger**: mỗi lần `ValuationTab` được mount (tức là mỗi lần user chuyển sang tab "Định Giá").

**Flow**:
1. Component mount → tạo `AbortController` → gọi `POST /api/valuation/run` với signal timeout 10 giây.
2. Trong khi đợi response: hiển thị overlay text **trong vùng lưới** (không phải full-page): "Đang tính toán định giá...".
3. Nếu POST trả về `200 { success: true }` → gọi `GET /api/valuation` → render bảng kết quả.
4. Component unmount (user switch tab đi) → `AbortController.abort()` để hủy request đang chờ.

**Xử lý các trường hợp lỗi POST — hiển thị trong vùng lưới**:
- Timeout (>10s hoặc abort): hiển thị "Tính toán quá thời gian (10s), vui lòng thử lại".
- HTTP 409 (concurrent run): hiển thị "Đang có phiên tính toán khác đang chạy, vui lòng đợi".
- HTTP 5xx khác: hiển thị "Lỗi tính toán, vui lòng thử lại".
- Trong tất cả trường hợp lỗi: không gọi `GET /api/valuation`.

**Bảng kết quả — cột hiển thị**:

| Cột | Data field | Format |
|-----|-----------|--------|
| STT | index (1-based) | Số nguyên |
| Mã CK | `StockCode` | Text |
| Giá Hiện Tại | `current_price` | Số, 2 decimal places |
| Giá Trị Nội Tại (MOS) | `MOS` | Số, 2 decimal places |
| Tỉ Suất Sinh Lời | `ti_suat_sinh_loi` | Phần trăm, 2 decimal places (nhân 100 khi hiển thị, ví dụ: 0.35 → "35.00%") |
| Cập Nhật Lúc | `updated_at` | Locale string |

**Màu nền theo hàng** (áp dụng lên `<tr>`):
- `ti_suat_sinh_loi > 0`: nền xanh nhạt `#e6f4ea`
- `ti_suat_sinh_loi < 0`: nền đỏ nhạt `#fce8e6`
- `ti_suat_sinh_loi = 0` hoặc null: nền mặc định

Bảng sắp xếp theo `ti_suat_sinh_loi` DESC (backend đã sort, frontend render theo thứ tự nhận được).

### 5.3 Backend — `POST /api/valuation/run`

**Concurrent lock**:
- Module-level flag `let isRunning = false` trong `valuation.ts`.
- Khi POST đến: nếu `isRunning === true` → trả về `409 { success: false, error: "concurrent_run" }` ngay lập tức.
- Nếu `isRunning === false` → set `isRunning = true`, bắt đầu chạy, sau đó `finally { isRunning = false }`.

**Xử lý per-bank (skip-and-continue)**:
- Vì không được sửa `/paybacktime/`, route handler gọi `runPaybacktime` **một lần cho mỗi ngân hàng** thay vì một lần cho toàn bộ list:
  ```
  const results = await Promise.allSettled(
      StockCodeList.map(code => runPaybacktime([code], calMos, 8))
  );
  const skipped = StockCodeList.filter((_, i) => results[i].status === "rejected");
  // log skipped banks
  ```
- Ngân hàng lỗi bị bỏ qua (không upsert DB), các ngân hàng khác vẫn chạy bình thường.

**Response**:
- `200 { success: true, skipped: [...] }` — `skipped` là mảng StockCode bị lỗi (thường rỗng).
- `500 { success: false, error: message }` chỉ khi có lỗi không mong đợi bên ngoài vòng lặp per-bank (ví dụ: DB connection fail toàn cục).

**Import**:
- `runPaybacktime` từ `../../../../paybacktime/runPaybacktime.ts`
- `calMos` từ `../../../../paybacktime/CalMos.ts`
- `StockCodeList`: `['ACB','BID','CTG','HDB','LPB','MBB','MSB','SHB','STB','TCB','TPB','VCB','VIB','VPB','SSB','BVB','NAB']` (17 ngân hàng, giống `PayBacktime.ts`)

### 5.4 Backend — `GET /api/valuation`

- Query: `SELECT StockCode, MOS, current_price, ti_suat_sinh_loi, updated_at FROM paybacktime ORDER BY ti_suat_sinh_loi DESC`.
- Trả về `200 { data: [...rows] }`.

---

## 6. Non-Functional Requirements

| ID | Yêu cầu |
|----|---------|
| NFR-1 | `POST /api/valuation/run` là synchronous — frontend đợi cho đến khi hoàn thành. Không có job queue, không có polling. |
| NFR-2 | Không thay đổi bất kỳ file nào trong `/paybacktime` — chỉ import và gọi. |
| NFR-3 | Không có authentication. API public như các route hiện tại. |
| NFR-4 | Frontend đặt timeout 10 giây cho `POST /api/valuation/run` qua `AbortController`. Nếu vượt quá → hiển thị lỗi timeout trong vùng lưới. Backend tiếp tục chạy đến hết (không có server-side timeout). |
| NFR-5 | Backend chặn concurrent run bằng `isRunning` flag (module-level). POST thứ hai trong khi POST đầu đang chạy → 409 ngay lập tức. |
| NFR-6 | Lỗi tính toán của một ngân hàng riêng lẻ (skip-and-continue) không làm fail toàn bộ batch. Backend dùng `Promise.allSettled` theo từng bank. |

---

## 7. Acceptance Criteria

| ID | Điều kiện kiểm thử | Pass khi |
|----|-------------------|---------|
| AC-1 | Khi trang load, tab "Xếp Hạng" được chọn mặc định và hiển thị BankList, TrendChart, RankingChart | Tab "Xếp Hạng" active, nội dung hiện tại không bị mất |
| AC-2 | Khi click tab "Định Giá", nội dung tab "Xếp Hạng" bị ẩn, component `ValuationTab` được render | Chỉ một tab content hiển thị tại một thời điểm |
| AC-3 | Khi `ValuationTab` mount, text "Đang tính toán định giá..." xuất hiện ngay lập tức trước khi POST hoàn thành | Loading state hiển thị trước khi có data |
| AC-4 | Sau khi `POST /api/valuation/run` trả về `{ success: true }`, bảng kết quả được hiển thị với đủ 6 cột: STT, Mã CK, Giá Hiện Tại, MOS, Tỉ Suất Sinh Lời, Cập Nhật Lúc | Bảng render đúng cột |
| AC-5 | Các hàng trong bảng được sắp xếp giảm dần theo `ti_suat_sinh_loi` (hàng đầu có `ti_suat_sinh_loi` cao nhất) | Hàng 1 ≥ Hàng 2 ≥ ... theo `ti_suat_sinh_loi` |
| AC-6 | Cột "Tỉ Suất Sinh Lời" hiển thị dạng phần trăm 2 decimal (ví dụ: 0.35 → "35.00%") | Format đúng |
| AC-7 | Nếu `POST /api/valuation/run` trả về HTTP 5xx, frontend hiển thị thông báo lỗi trong vùng lưới, không gọi GET | Không có unhandled rejection; không render bảng rỗng mà không báo |
| AC-8 | Khi click lại tab "Xếp Hạng" sau khi đã vào tab "Định Giá", nội dung "Xếp Hạng" hiển thị lại đúng (BankList, chart không bị vỡ) | Không có regression trên tab "Xếp Hạng" |
| AC-9 | Khi chuyển sang tab "Định Giá" lần thứ hai (sau khi đã vào lần đầu), flow POST → GET chạy lại từ đầu | Mỗi lần mount `ValuationTab` đều trigger tính toán mới |
| AC-10 | `POST /api/valuation/run` chạy `runPaybacktime` per-bank với `numberOfYear = 8`, kết quả upsert vào bảng `paybacktime` | Sau khi POST hoàn thành (không có bank nào fail), `SELECT COUNT(*) FROM paybacktime` = 17 |
| AC-11 | `GET /api/valuation` trả về HTTP 200 và JSON với field `data` là array, mỗi phần tử có `StockCode`, `MOS`, `current_price`, `ti_suat_sinh_loi`, `updated_at` | Response schema đúng |
| AC-12 | `GET /api/valuation` sort theo `ti_suat_sinh_loi DESC` ở tầng DB (không phải frontend) | Query có `ORDER BY ti_suat_sinh_loi DESC` |
| AC-13 | Khi `POST /api/valuation/run` được gọi lần 2 trong khi lần 1 chưa xong, backend trả về `409` ngay lập tức; frontend hiển thị "Đang có phiên tính toán khác đang chạy" trong vùng lưới | Không có 2 instance `runPaybacktime` chạy cùng lúc |
| AC-14 | Khi 1 ngân hàng fail (GetTradeInfo throws), các ngân hàng còn lại vẫn được tính và upsert; POST trả về `200 { success: true, skipped: ["<code>"] }` | Không phải toàn bộ batch fail khi 1 bank lỗi |
| AC-15 | Nếu POST chưa trả về response sau 10 giây, frontend hủy request và hiển thị "Tính toán quá thời gian (10s), vui lòng thử lại" trong vùng lưới | Không bị treo vô hạn; không gọi GET |
| AC-16 | Hàng có `ti_suat_sinh_loi > 0` có nền xanh nhạt (#e6f4ea); hàng có `ti_suat_sinh_loi < 0` có nền đỏ nhạt (#fce8e6) | Màu nền đúng theo dấu của tỉ suất |

---

## 8. Examples

### Normal Cases

**N-1**: Chạy thành công, hiển thị bảng đầy đủ

- Pre-condition: DB có kết nối, external API `GetTradeInfo` hoạt động bình thường, `isRunning = false`.
- Action: User click tab "Định Giá".
- Expected:
  - Vùng lưới hiển thị "Đang tính toán định giá..." trong khi POST chạy.
  - POST hoàn thành trong <10s → bảng hiện ra với 17 hàng.
  - Hàng 1 có `ti_suat_sinh_loi` lớn nhất, ví dụ: `VCB | 45.2 | 28.5 | 63.06%` (nền xanh).
  - Hàng có `ti_suat_sinh_loi < 0` hiển thị nền đỏ.
  - `updated_at` của mỗi hàng xấp xỉ thời điểm vừa chạy.

**N-2**: User chuyển tab "Xếp Hạng" → "Định Giá" nhiều lần

- Action: Click "Xếp Hạng" → click "Định Giá" → click "Xếp Hạng" → click "Định Giá".
- Expected:
  - Mỗi lần vào tab "Định Giá" đều trigger POST mới.
  - Tab "Xếp Hạng" mỗi lần quay lại đều hiển thị đúng data, không bị reset hay lỗi.

### Abnormal Cases

**A-1**: External API `GetTradeInfo` trả lỗi cho 1 ngân hàng

- Pre-condition: `GetTradeInfo("MSB")` throws exception.
- Expected:
  - `runPaybacktime(["MSB"], calMos, 8)` reject → `Promise.allSettled` ghi nhận rejected cho MSB, các bank khác vẫn chạy.
  - POST trả về `200 { success: true, skipped: ["MSB"] }`.
  - Frontend nhận `success: true` → gọi GET → render bảng với 16 hàng (MSB không có hoặc còn data cũ từ lần chạy trước).

**A-2**: POST được gọi lần 2 trong khi lần 1 đang chạy

- Pre-condition: `isRunning = true` (POST lần 1 đang trong progress).
- Action: User switch tab đi rồi switch lại → `ValuationTab` re-mount → gọi POST lần 2.
- Expected: Backend trả về `409 { success: false, error: "concurrent_run" }` ngay lập tức → Frontend hiển thị "Đang có phiên tính toán khác đang chạy" trong vùng lưới, không gọi GET.

**A-3**: DB không kết nối được khi chạy GET

- Pre-condition: MySQL down sau khi POST đã thành công.
- Action: `GET /api/valuation` được gọi.
- Expected: API trả về 500, frontend hiển thị lỗi trong vùng lưới thay vì crash.

### Boundary Cases

**B-1**: Bảng `paybacktime` rỗng (chạy lần đầu, POST vừa xong nhưng DB chưa có row nào do lỗi insert)

- Expected: `GET /api/valuation` trả về `{ data: [] }`, frontend render bảng rỗng (không crash), không hiển thị loading vĩnh viễn.

**B-2**: `ti_suat_sinh_loi = 0` (MOS = 0 hoặc current_price rất lớn)

- Expected: Hàng này được hiển thị bình thường với "0.00%", không bị lọc ra hoặc gây lỗi chia 0 trên frontend.

**B-3**: `ti_suat_sinh_loi` âm (current_price > MOS × 2, ví dụ current_price = 50, MOS = 10 → ratio = 0.2 nhưng nếu MOS âm → ratio âm)

- Expected: Hiển thị đúng giá trị âm (ví dụ "-15.00%"), sắp xếp sau các hàng dương.

**B-4**: Tất cả 17 ngân hàng có `ti_suat_sinh_loi` bằng nhau

- Expected: Thứ tự hiển thị là thứ tự trả về từ DB (ORDER BY ti_suat_sinh_loi DESC, secondary order không xác định) — không crash.

**B-5**: POST chạy hơn 10 giây (external API chậm)

- Pre-condition: Mỗi `GetTradeInfo` call mất 2 giây, 17 ngân hàng chạy `Promise.allSettled` đồng thời → bottleneck là bank chậm nhất.
- Action: Frontend `AbortController` fire sau 10 giây.
- Expected: Frontend hủy fetch → hiển thị "Tính toán quá thời gian (10s), vui lòng thử lại" trong vùng lưới → không gọi GET. Backend tiếp tục chạy đến hết và set `isRunning = false` khi xong.

---

## 9. Open Issues

Tất cả Open Issues đã được giải quyết.

| ID | Câu hỏi | Quyết định | Status |
|----|---------|-----------|--------|
| OI-1 | Timeout policy cho `POST /api/valuation/run` | Frontend AbortController 10s; hiển thị lỗi trong vùng lưới; backend không có server-side timeout | **CLOSED** |
| OI-2 | Concurrent run | Backend `isRunning` flag → 409 ngay; frontend AbortController hủy khi unmount | **CLOSED** |
| OI-3 | Fail-fast vs skip-and-continue | Skip-and-continue: `Promise.allSettled` per-bank, trả `skipped: [...]` | **CLOSED** |
| OI-4 | Wireframe UI | Row coloring (xanh/đỏ), 2 decimal, locale string cho datetime, không responsive | **CLOSED** |

---

## 10. Risks

| ID | Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|----|--------|----------|-----------|-----------|
| R-1 | External API `GetTradeInfo` chậm → frontend timeout 10s, backend chạy tiếp nhưng client đã disconnect; lần sau user thử lại sẽ nhận 409 nếu backend còn `isRunning = true` | Cao | Trung bình | Đã giảm thiểu: timeout + lock + skip-and-continue. Rủi ro còn lại: user bị 409 cho đến khi backend computation xong. |
| R-2 | Import cross-package từ backend sang `/paybacktime` (TypeScript path) có thể gặp lỗi tsconfig | Trung bình | Trung bình | Verify `tsconfig.json` paths trước khi code |
| R-3 | `runPaybacktime` dùng `Promise.all` — 17 concurrent requests đến external API có thể bị rate-limit | Thấp | Trung bình | Monitor khi chạy thực tế; nếu cần thêm throttle thì sửa trong `runPaybacktime` (out of scope lần này) |
| R-4 | Chuyển từ scroll sang tab có thể làm mất state (selectedBank, selectedPeriod) khi switch tab | Thấp | Thấp | Giữ state ở `App.tsx` (không unmount), hoặc accept reset state khi switch |

---

## 11. Traceability Table

| AC | Screen / Component | API | DB | Log | Permissions | Test Type |
|----|-------------------|-----|-----|-----|-------------|-----------|
| AC-1 | App.tsx — tab "Xếp Hạng" mặc định | — | — | — | — | E2E |
| AC-2 | App.tsx — tab switch logic | — | — | — | — | E2E |
| AC-3 | ValuationTab — loading state | POST /api/valuation/run | — | — | — | E2E / IT |
| AC-4 | ValuationTab — bảng kết quả (6 cột) | GET /api/valuation | paybacktime | — | — | E2E / IT |
| AC-5 | ValuationTab — thứ tự hàng | GET /api/valuation | paybacktime (ORDER BY) | — | — | IT / BB |
| AC-6 | ValuationTab — format % | — | — | — | — | UT (formatter fn) |
| AC-7 | ValuationTab — error state (5xx) | POST /api/valuation/run (5xx) | — | — | — | IT / E2E |
| AC-8 | App.tsx — tab "Xếp Hạng" sau switch | — | — | — | — | E2E |
| AC-9 | ValuationTab — re-mount trigger | POST /api/valuation/run | — | — | — | E2E |
| AC-10 | — | POST /api/valuation/run | paybacktime (upsert) | console.log (saveMos) | — | IT |
| AC-11 | — | GET /api/valuation | paybacktime | — | — | IT |
| AC-12 | — | GET /api/valuation | paybacktime (ORDER BY) | — | — | IT |
| AC-13 | ValuationTab — concurrent state | POST /api/valuation/run (409) | — | — | — | IT / E2E |
| AC-14 | — | POST /api/valuation/run | paybacktime (partial upsert) | console.error (skipped) | — | IT |
| AC-15 | ValuationTab — timeout state | POST /api/valuation/run (AbortController 10s) | — | — | — | IT / E2E |
| AC-16 | ValuationTab — row coloring | GET /api/valuation | — | — | — | E2E / BB |

---

## 12. Phán định: Có thể bắt đầu implementation chưa?

**Yes — sẵn sàng implement toàn bộ.**

Tất cả 4 Open Issues đã được giải quyết. Spec đủ để bắt đầu implementation theo thứ tự sau:

1. `backend/src/routes/valuation.ts` — POST (concurrent lock + per-bank allSettled) + GET
2. `frontend/src/components/ValuationTab.tsx` — loading/error/concurrent/timeout states + bảng kết quả với row coloring
3. `frontend/src/App.tsx` — tab navigator (state + render logic)
