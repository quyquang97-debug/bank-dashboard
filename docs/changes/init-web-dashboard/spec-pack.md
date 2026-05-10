# Spec Pack — init-web-dashboard

**Version**: 1.1  
**Date**: 2026-05-08  
**Status**: FINAL — tất cả Open Issues đã đóng, sẵn sàng implementation

---

## 1. Background / Purpose

Dự án xây dựng một web dashboard cho phép người dùng theo dõi và so sánh sức khỏe tài chính của các ngân hàng niêm yết tại Việt Nam, dựa trên dữ liệu Báo Cáo Tài Chính (BCTC) đã được crawl và lưu vào database MySQL (`finance.bctc_new`).

Mục tiêu: cung cấp cái nhìn nhanh qua 4 chỉ số chính (NPL, LLR, LDR, tăng trưởng doanh thu) và hỗ trợ so sánh xếp hạng giữa các ngân hàng.

---

## 2. Scope

### Làm gì (In-scope)

- Hiển thị danh sách ngân hàng với 4 chỉ số tài chính chính của kỳ mới nhất
- Biểu đồ xu hướng theo năm (YoY) cho từng ngân hàng
- Biểu đồ xếp hạng (Cross-Bank Ranking) theo logic chấm điểm định sẵn

### Không làm (Out-of-scope)

- Crawl / thu thập dữ liệu BCTC (đã có hệ thống riêng)
- Chỉnh sửa hay nhập tay dữ liệu qua dashboard
- Phân tích `paybacktime` / `paybacktime6year` (thuộc module khác)
- Export báo cáo PDF/Excel
- Thông báo / alert khi chỉ số vượt ngưỡng

---

## 3. Terminology

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| BCTC | Báo Cáo Tài Chính |
| StockCode | Mã chứng khoán của ngân hàng (3 ký tự, ví dụ: VCB, TCB, BID) |
| NPL | Non-Performing Loan Ratio — Tỷ lệ nợ xấu (%) = (NoCoKhaNangMatVon + NoNghiNgo + NoDuoiTieuChuan) / TongChoVay × 100 |
| LLR | Loan Loss Reserve Ratio — Tỷ lệ dự phòng bao phủ nợ xấu (%) = TrichLuyDuPhong / (tổng nợ xấu) × 100 |
| LDR | Loan-to-Deposit Ratio — Tỷ lệ cho vay trên huy động (%) = TongChoVay / TongTienGui × 100 |
| TangTruongDoanhThu | Tăng trưởng doanh thu YoY (%) = (DoanhThuNamNay − DoanhThuNamNgoai) / DoanhThuNamNgoai × 100 |
| Kỳ mới nhất | (Year, Quarter) có giá trị MAX(Year × 10 + Quarter) trong bảng `bctc_new`. Quarter=0 = báo cáo năm (thường niên), Quarter=1-4 = báo cáo quý |
| total_diem | Tổng điểm ranking = NPL_diem + LLR_diem + LDR_diem + TangTruongDoanhThu_diem |
| YoY | Year-over-Year — so sánh cùng kỳ năm trước |

---

## 4. As-Is / To-Be

### As-Is

- Dữ liệu BCTC đã có trong MySQL, được crawl định kỳ và lưu vào `bctc_new`
- Không có giao diện trực quan; để xem dữ liệu phải truy vấn DB thủ công

### To-Be

- Web dashboard với 3 màn hình / khu vực chính:
  1. **Bank List** — Danh sách ngân hàng + 4 chỉ số kỳ mới nhất
  2. **YoY Trend** — Biểu đồ xu hướng theo năm cho từng ngân hàng
  3. **Cross-Bank Ranking** — Biểu đồ so sánh xếp hạng giữa các ngân hàng

---

## 5. Detailed Specification

### 5.1 Feature 1 — Bank List (Danh Sách Ngân Hàng)

**Mô tả**: Hiển thị bảng danh sách tất cả ngân hàng có dữ liệu trong kỳ (Year, Quarter) mới nhất của bảng `bctc_new`.

**Dữ liệu hiển thị mỗi hàng**:

| Cột | Nguồn | Ghi chú |
|-----|-------|---------|
| StockCode | `bctc_new.StockCode` | Mã ngân hàng |
| NPL | `bctc_new.NPL` | Đơn vị % |
| LLR | `bctc_new.LLR` | Đơn vị % |
| LDR | `bctc_new.LDR` | Đơn vị % |
| Tăng Trưởng Doanh Thu | `bctc_new.TangTruongDoanhThu` | Đơn vị % |
| Điểm Tổng (Ranking) | tính từ `cal_diem.sql` trên toàn bộ `bctc_new` | Hiển thị để giải thích thứ tự sắp xếp |

**Thứ tự sắp xếp**: Theo `total_diem` giảm dần (ngân hàng tốt nhất theo ranking hiển thị đầu tiên).

**Logic xác định kỳ mới nhất** (theo `detectWindow` trong `bank-analysis/src/scheduler.ts`):

1. Gọi `detectWindow(today)`. Nếu có window active → dùng `(year, quarter)` trả về.
2. Nếu `detectWindow` trả về `null` (ngoài tất cả các window) → dùng `(Year, Quarter)` có `MAX(Year * 10 + Quarter)` trong DB.

Mapping tháng → kỳ:
| Tháng crawl | Year | Quarter | Loại báo cáo |
|-------------|------|---------|-------------|
| Tháng 1 (15-31) | năm trước | 4 | Báo cáo quý 4 |
| Tháng 3 (15-31) | năm trước | 0 | Báo cáo thường niên |
| Tháng 4 (15-30) | năm nay | 1 | Báo cáo quý 1 |
| Tháng 7 (15-31) | năm nay | 2 | Báo cáo quý 2 |
| Tháng 10 (15-31) | năm nay | 3 | Báo cáo quý 3 |

**Trạng thái rỗng**: Nếu bảng không có bản ghi nào, hiển thị thông báo "Không có dữ liệu".

---

### 5.2 Feature 2 — YoY Trend Chart (Biểu Đồ Xu Hướng)

**Mô tả**: Khi người dùng chọn một ngân hàng, hiển thị **2 biểu đồ line chart riêng biệt**:

**Biểu đồ A — Theo năm (Quarter=0, báo cáo thường niên)**:
- Filter: `StockCode = <chọn>` AND `Quarter = 0`
- Trục X: `Year` (ví dụ: 2022, 2023, 2024)
- Trục Y: giá trị 4 chỉ số (NPL, LLR, LDR, TangTruongDoanhThu) và total_diem
- Mỗi chỉ số là 1 đường riêng

**Biểu đồ B — Theo quý (Quarter=1–4)**:
- Filter: `StockCode = <chọn>` AND `Quarter IN (1,2,3,4)`
- Trục X: label dạng `{Year}Q{Quarter}` (ví dụ: 2024Q1, 2024Q2, 2025Q1), sắp xếp tăng dần theo (Year, Quarter)
- Trục Y: giá trị 4 chỉ số (NPL, LLR, LDR, TangTruongDoanhThu) và total_diem
- Mỗi chỉ số là 1 đường riêng

**Chỉ số hiển thị** (cả 2 biểu đồ): NPL, LLR, LDR, TangTruongDoanhThu, total_diem — 5 đường, có thể toggle từng đường.

**Trường hợp đặc biệt**:
- Nếu không có dữ liệu thường niên (Quarter=0): ẩn Biểu đồ A, hiển thị thông báo "Chưa có dữ liệu báo cáo năm"
- Nếu không có dữ liệu quý (Quarter=1–4): ẩn Biểu đồ B, hiển thị thông báo "Chưa có dữ liệu báo cáo quý"
- Nếu chỉ có 1 điểm dữ liệu trong biểu đồ: hiển thị 1 điểm, không có đường nối, không crash

---

### 5.3 Feature 3 — Cross-Bank Ranking (Xếp Hạng Ngân Hàng)

**Mô tả**: Tính điểm và xếp hạng tất cả ngân hàng trong kỳ mới nhất, hiển thị dưới dạng biểu đồ so sánh (bar chart hoặc horizontal bar).

**Logic chấm điểm** (theo `cal_diem.sql`):

| Chỉ số | Cách tính điểm | Ý nghĩa |
|--------|----------------|---------|
| NPL_diem | RANK() OVER (ORDER BY NPL DESC) | NPL thấp hơn → điểm cao hơn → tốt hơn |
| LLR_diem | RANK() OVER (ORDER BY LLR ASC) | LLR cao hơn → điểm cao hơn → tốt hơn |
| LDR_diem | RANK() OVER (ORDER BY LDR DESC) | LDR thấp hơn → điểm cao hơn → tốt hơn |
| TangTruongDoanhThu_diem | RANK() OVER (ORDER BY TangTruongDoanhThu ASC) | Tăng trưởng cao hơn → điểm cao hơn → tốt hơn |
| **total_diem** | NPL_diem + LLR_diem + LDR_diem + TangTruongDoanhThu_diem | Tổng điểm — cao hơn = tốt hơn |

**Hiển thị**: Biểu đồ sắp xếp các ngân hàng theo `total_diem` giảm dần (ngân hàng có điểm cao nhất = tốt nhất hiển thị trước).

**Scope**: Ranking tính trên **toàn bộ bản ghi** trong `bctc_new` (không filter theo kỳ).

**Xử lý NULL/0**: Ngân hàng vẫn tham gia ranking; chỉ bỏ qua metric cụ thể bị NULL khi tính điểm cho metric đó (không loại toàn bộ ngân hàng).

---

## 6. Non-Functional Requirements

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| NFR-1 | Dashboard load trong vòng 3 giây trên kết nối bình thường | Chưa có SLA chính thức — xem D6 |
| NFR-2 | Responsive, hiển thị được trên màn hình >= 1280px | Mobile out-of-scope trừ khi có yêu cầu thêm |
| NFR-3 | Không yêu cầu authentication | Đã xác nhận — public dashboard |
| NFR-4 | Database connection sử dụng biến môi trường (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) | Đã thấy trong db.ts |
| NFR-5 | Frontend: React. Backend: Node.js + Express (REST API). | Đã quyết định 2026-05-08 |

---

## 7. Acceptance Criteria

### Feature 1 — Bank List

**AC-1**: Khi truy cập trang chính, hệ thống xác định (Year, Quarter) theo logic `detectWindow(today)` (từ `bank-analysis/src/scheduler.ts`); nếu `detectWindow` trả về null thì dùng MAX(Year×10+Quarter) trong `bctc_new` làm fallback. Chỉ hiển thị các ngân hàng có dữ liệu trong kỳ đó.

**AC-2**: Mỗi hàng trong danh sách hiển thị đầy đủ: StockCode, NPL (%), LLR (%), LDR (%), TangTruongDoanhThu (%), Điểm Tổng (total_diem).

**AC-2b**: Danh sách ngân hàng được sắp xếp theo total_diem giảm dần (tính trên toàn bộ `bctc_new`).

**AC-3**: Nếu bảng `bctc_new` không có bản ghi nào, trang hiển thị thông báo trạng thái "Không có dữ liệu" thay vì bảng trống không có chú thích.

**AC-4**: Nếu một chỉ số của ngân hàng là NULL, ô đó hiển thị "—" thay vì lỗi hoặc "0".

### Feature 2 — YoY Trend Chart

**AC-5**: Khi người dùng chọn một ngân hàng, hệ thống hiển thị 2 biểu đồ riêng: Biểu đồ A (dữ liệu năm — Quarter=0) và Biểu đồ B (dữ liệu quý — Quarter=1–4).

**AC-6**: Biểu đồ A có trục X là Year; Biểu đồ B có trục X dạng `{Year}Q{Quarter}` sắp xếp tăng dần theo (Year, Quarter).

**AC-7**: Mỗi biểu đồ hiển thị 5 đường: NPL, LLR, LDR, TangTruongDoanhThu, total_diem — người dùng có thể toggle từng đường.

**AC-8**: Nếu không có dữ liệu cho một loại báo cáo (năm hoặc quý), biểu đồ tương ứng ẩn đi và hiển thị thông báo thay thế (không crash).

**AC-9-trend**: Khi không có ngân hàng nào được chọn, khu vực trend hiển thị placeholder hướng dẫn chọn ngân hàng từ Bank List.

### Feature 3 — Cross-Bank Ranking

**AC-10-rank**: Hệ thống tính NPL_diem, LLR_diem, LDR_diem, TangTruongDoanhThu_diem bằng RANK() OVER theo đúng chiều sort trong `cal_diem.sql`, và tính total_diem = tổng 4 cột trên. Nếu một metric của ngân hàng là NULL, chỉ bỏ qua metric đó khi tính RANK — các metric còn lại vẫn tính bình thường.

**AC-10**: Ranking tính trên **toàn bộ bản ghi** trong `bctc_new` (không filter theo kỳ) — đúng như thiết kế của `cal_diem.sql`.

**AC-11**: Biểu đồ ranking hiển thị total_diem của từng ngân hàng, sắp xếp theo total_diem giảm dần.

**AC-12**: Nếu chỉ có 1 ngân hàng trong kỳ mới nhất, biểu đồ ranking vẫn hiển thị ngân hàng đó với RANK=1 cho cả 4 metrics (total_diem = 4).

---

## 8. Examples

### 8.1 Normal Cases

**Normal-1 — Hiển thị danh sách 5 ngân hàng**

Giả sử kỳ mới nhất là Q4/2024 (Year=2024, Quarter=4). Bảng `bctc_new` có 5 bản ghi với Quarter=4, Year=2024:

| StockCode | NPL | LLR | LDR | TangTruongDoanhThu |
|-----------|-----|-----|-----|--------------------|
| VCB | 1.20 | 180.5 | 78.3 | 12.5 |
| TCB | 2.10 | 95.0 | 82.1 | 8.3 |
| BID | 1.85 | 110.0 | 85.5 | 5.1 |
| MBB | 1.60 | 140.0 | 76.0 | 15.2 |
| ACB | 1.30 | 130.0 | 88.0 | 10.0 |

**Kết quả mong đợi**: Trang hiển thị bảng 5 hàng với đúng các giá trị trên.

---

**Normal-2 — Biểu đồ trend VCB**

User click vào VCB. `bctc_new` có dữ liệu: Quarter=0 cho 2022, 2023, 2024; Quarter=1,2,3,4 cho 2023 và 2024.

**Kết quả mong đợi**:
- Biểu đồ A (năm): 3 điểm trên trục X (2022, 2023, 2024), 5 đường (NPL, LLR, LDR, TangTruongDoanhThu, total_diem)
- Biểu đồ B (quý): 8 điểm trên trục X (2023Q1 → 2024Q4), 5 đường tương tự

---

### 8.2 Abnormal Cases

**Abnormal-1 — Database chưa có dữ liệu**

`bctc_new` rỗng (chưa crawl lần nào).

**Kết quả mong đợi**: Tất cả 3 khu vực (Bank List, Trend, Ranking) hiển thị thông báo "Không có dữ liệu", không crash, không hiện bảng/biểu đồ trống không có chú thích.

---

**Abnormal-2 — Ngân hàng có chỉ số NULL**

Bản ghi TCB Q4/2024 có `NPL = NULL` (dữ liệu chưa đủ để tính).

**Kết quả mong đợi**:
- Trong Bank List: cột NPL của TCB hiển thị "—"
- Trong Ranking: TCB vẫn có NPL_diem=NULL (bỏ qua metric này), LLR_diem/LDR_diem/TangTruongDoanhThu_diem vẫn tính bình thường; total_diem = tổng các metric còn lại

---

### 8.3 Boundary Values

**Boundary-1 — Chỉ 1 ngân hàng trong kỳ mới nhất**

`bctc_new` chỉ có 1 bản ghi cho kỳ Q1/2025: VCB.

**Kết quả mong đợi**:
- Bank List: 1 hàng (VCB)
- Ranking: VCB với NPL_diem=1, LLR_diem=1, LDR_diem=1, TangTruongDoanhThu_diem=1, total_diem=4
- Không crash, không báo lỗi "division by zero" hay tương tự

---

**Boundary-2 — TangTruongDoanhThu = 0 (doanh thu không đổi)**

DoanhThuNamNay = DoanhThuNamNgoai = 500,000 (triệu đồng).

**Kết quả mong đợi**: TangTruongDoanhThu hiển thị 0.00%, không hiển thị lỗi. (Trigger đã xử lý: nếu DoanhThuNamNgoai ≠ 0 thì tính bình thường = 0%).

---

**Boundary-3 — Ngân hàng chỉ có 1 năm dữ liệu trong trend chart**

VCB chỉ có dữ liệu Year=2024 (1 bản ghi).

**Kết quả mong đợi**: Biểu đồ trend hiển thị 1 điểm trên trục X, không có đường nối, không crash.

---

## 9. Open Issues

Các vấn đề chưa được quyết định — **không được implement** cho đến khi có câu trả lời:

| # | Câu hỏi | Ảnh hưởng | Ưu tiên |
|---|---------|-----------|---------|
| ~~OI-1~~ | ~~Logic "kỳ mới nhất"~~ **✅ ĐÓNG** — Dùng `detectWindow(today)` (từ `bank-analysis/src/scheduler.ts`). Nếu null → fallback MAX(Year×10+Quarter) trong DB. | — | — |
| ~~OI-2~~ | ~~Trigger `updateValue` có hoạt động trên `bctc_new` không?~~ **✅ ĐÓNG** — Trigger tồn tại và hoạt động đúng trên `bctc_new`. Vấn đề còn lại: INSERT đầu tiên không kích hoạt trigger → một số ngân hàng có derived = 0. Cần fix ở data pipeline hoặc tính on-the-fly ở API. | Tất cả AC | — |
| ~~OI-2b~~ | ~~Derived metrics = 0 cho records mới~~ **✅ ĐÓNG** — Fix ở **data pipeline** (`db.ts`): tính NPL/LLR/LDR/TangTruongDoanhThu trước khi INSERT thay vì hardcode 0. API đọc trực tiếp cột đã tính trong DB. | — | — |
| ~~OI-3~~ | ~~Ranking áp dụng cho kỳ nào?~~ **✅ ĐÓNG** — Ranking tính trên **toàn bộ kỳ** trong `bctc_new`, không filter. `cal_diem.sql` đúng như thiết kế. | — | — |
| ~~OI-4~~ | ~~Trục X biểu đồ trend~~ **✅ ĐÓNG** — 2 biểu đồ riêng: Biểu đồ A (Quarter=0, trục X = Year), Biểu đồ B (Quarter=1–4, trục X = `{Year}Q{Quarter}`). | — | — |
| ~~OI-5~~ | ~~Chỉ số hiển thị trong trend~~ **✅ ĐÓNG** — Cả 4 chỉ số + total_diem, có toggle từng đường. | — | — |
| ~~OI-6~~ | ~~Xử lý NULL trong ranking~~ **✅ ĐÓNG** — Bỏ qua chỉ metric bị NULL, không loại cả ngân hàng. | — | — |
| ~~OI-7~~ | ~~Tech stack~~ **✅ ĐÓNG** — Frontend: **React**. Backend: **Node.js + Express**. | — | — |
| ~~OI-8~~ | ~~Authentication~~ **✅ ĐÓNG** — Không cần authentication. | — | — |
| ~~OI-9~~ | ~~Thứ tự sắp xếp Bank List~~ **✅ ĐÓNG** — Sắp xếp theo total_diem giảm dần. | — | — |

---

## 10. Risks

| # | Rủi ro | Khả năng | Ảnh hưởng | Biện pháp |
|---|--------|----------|-----------|-----------|
| R1 | Dữ liệu trong `bctc_new` thực tế có NPL/LLR/LDR = 0 do trigger không hoạt động (M1, M2) | Cao | Cao | Xác minh dữ liệu thực trong DB trước khi implement UI |
| R2 | Ranking bị sai do `cal_diem.sql` không filter kỳ, mix nhiều kỳ | Cao | Trung bình | Giải quyết OI-3 trước |
| R3 | Không có mock/seed data để phát triển UI | Trung bình | Trung bình | Tạo seed data hoặc dùng dữ liệu thực từ dev DB |
| R4 | Chỉ số NULL gây crash biểu đồ (charting library thường không xử lý tốt NULL) | Trung bình | Thấp | Sanitize data trước khi truyền vào chart |

---

## 11. Traceability Table

| AC | Screen/Component | API/Query | DB Table | Log | Permissions | Test Type |
|----|-----------------|-----------|----------|-----|-------------|-----------|
| AC-1 | Bank List table | GET /api/banks | bctc_new | — | — | IT, E2E |
| AC-2 | Bank List table (columns: 4 chỉ số + total_diem) | GET /api/banks | bctc_new | — | — | UT, E2E |
| AC-2b | Bank List table (sort by total_diem DESC) | GET /api/banks | bctc_new | — | — | UT, E2E |
| AC-3 | Bank List — empty state | GET /api/banks | bctc_new | — | — | IT, E2E |
| AC-4 | Bank List table (NULL cell → "—") | GET /api/banks | bctc_new | — | — | UT, BB |
| AC-5 | Trend — 2 biểu đồ riêng (năm / quý) | GET /api/banks/:code/trend | bctc_new | — | — | IT, E2E |
| AC-6 | Trend — trục X: Year (A) / YearQQuarter (B) | GET /api/banks/:code/trend | bctc_new | — | — | UT, BB |
| AC-7 | Trend — 5 đường có toggle | GET /api/banks/:code/trend | bctc_new | — | — | UT, E2E |
| AC-8 | Trend — ẩn biểu đồ khi không có dữ liệu loại đó | GET /api/banks/:code/trend | bctc_new | — | — | IT, BB |
| AC-9-trend | Trend — placeholder khi chưa chọn ngân hàng | — | — | — | — | E2E |
| AC-10-rank | Ranking Chart (RANK() OVER, bỏ qua metric NULL) | GET /api/ranking | bctc_new | — | — | UT, IT, BB |
| AC-10 | Ranking Chart (toàn bộ bctc_new, không filter kỳ) | GET /api/ranking | bctc_new | — | — | IT |
| AC-11 | Ranking Chart (sort total_diem DESC) | GET /api/ranking | bctc_new | — | — | UT, E2E |
| AC-12 | Ranking Chart (1 ngân hàng → total_diem=4) | GET /api/ranking | bctc_new | — | — | BB |

**Chú thích test type**: UT = Unit Test, IT = Integration Test, E2E = End-to-End, BB = Black-Box / Boundary

---

## 12. Phán định: Có thể bắt đầu implementation chưa?

**→ YES** *(cập nhật 2026-05-08: tất cả Open Issues đã đóng — FINAL)*

### Lý do

Tất cả 9 Open Issues đã được giải quyết. Spec Pack đủ để bắt đầu implementation ngay.

### Việc cần làm trước khi chạy dashboard lần đầu

1. **Fix `db.ts`** ở repo `bank-analysis` (Hướng A): tính NPL/LLR/LDR/TangTruongDoanhThu từ raw columns trước khi INSERT thay vì hardcode 0
2. **Backfill dữ liệu Q1/2026**: chạy UPDATE thủ công cho BID, LPB, TCB, MBB, STB để trigger tính lại derived values đang = 0
