# Black-Box Test Cases — init-web-dashboard

**Version**: draft-1.0 (Phase 2)  
**Date**: 2026-05-08

Các test case này được thiết kế từ spec-pack §8 (Examples). Tester không cần biết implementation — chỉ dựa vào input/output observable.

---

## BB-Normal-1: Hiển thị danh sách 5 ngân hàng

**Precondition**: `bctc_new` có đúng 5 bản ghi cho kỳ Q4/2024:

| StockCode | NPL | LLR | LDR | TangTruongDoanhThu |
|-----------|-----|-----|-----|--------------------|
| VCB | 1.20 | 180.5 | 78.3 | 12.5 |
| TCB | 2.10 | 95.0 | 82.1 | 8.3 |
| BID | 1.85 | 110.0 | 85.5 | 5.1 |
| MBB | 1.60 | 140.0 | 76.0 | 15.2 |
| ACB | 1.30 | 130.0 | 88.0 | 10.0 |

**Action**: Mở trang dashboard.

**Expected**:
- Bảng hiển thị đúng 5 hàng
- Mỗi hàng có đúng các giá trị trên
- Hàng đầu tiên là ngân hàng có total_diem cao nhất (tính theo RANK logic)
- Không có thông báo lỗi, không có hàng trống

---

## BB-Normal-2: Biểu đồ trend VCB (annual + quarterly)

**Precondition**: VCB có dữ liệu:
- Quarter=0: 2022, 2023, 2024
- Quarter=1,2,3,4: 2023 và 2024

**Action**: Click vào hàng VCB trong Bank List.

**Expected**:
- Chart A (báo cáo năm) xuất hiện với 3 điểm trên trục X: 2022, 2023, 2024
- Chart B (báo cáo quý) xuất hiện với 8 điểm: 2023Q1, 2023Q2, 2023Q3, 2023Q4, 2024Q1, 2024Q2, 2024Q3, 2024Q4
- Cả 2 biểu đồ hiển thị 5 đường: NPL, LLR, LDR, TangTruongDoanhThu, total_diem
- Toggle ẩn/hiện từng đường hoạt động
- Không crash

---

## BB-Abnormal-1: Database rỗng

**Precondition**: `bctc_new` không có bản ghi nào.

**Action**: Mở trang dashboard.

**Expected**:
- Khu vực Bank List: hiển thị "Không có dữ liệu"
- Khu vực Trend: hiển thị placeholder (hoặc "Không có dữ liệu")
- Khu vực Ranking: hiển thị "Không có dữ liệu"
- Không có bảng trống không có chú thích
- Không có lỗi JavaScript trong console

---

## BB-Abnormal-2: Ngân hàng có chỉ số NULL

**Precondition**: `bctc_new` có bản ghi TCB với `NPL = NULL` (các chỉ số khác có giá trị).

**Action**: Mở trang dashboard. Xem hàng TCB.

**Expected**:
- Cột NPL của TCB hiển thị "—" (không phải "0", không phải lỗi, không phải "null")
- Cột LLR, LDR, TangTruongDoanhThu của TCB hiển thị giá trị bình thường
- Trong Ranking chart: TCB vẫn xuất hiện; chỉ thiếu NPL_diem, nhưng total_diem = LLR_diem + LDR_diem + TangTruongDoanhThu_diem

---

## BB-Boundary-1: Chỉ 1 ngân hàng trong DB

**Precondition**: `bctc_new` chỉ có 1 bản ghi: VCB, Q1/2025.

**Action**: Mở trang dashboard.

**Expected**:
- Bank List: 1 hàng (VCB)
- Ranking chart: VCB hiển thị với total_diem = 4 (NPL_diem=1, LLR_diem=1, LDR_diem=1, TangTruongDoanhThu_diem=1)
- Không crash, không báo lỗi "division by zero" hay tương tự

---

## BB-Boundary-2: TangTruongDoanhThu = 0

**Precondition**: Bản ghi với TangTruongDoanhThu = 0.00 (DoanhThuNamNay = DoanhThuNamNgoai).

**Action**: Xem hàng ngân hàng này trong Bank List.

**Expected**:
- Cột Tăng Trưởng hiển thị "0.00%" (không phải "—", không phải lỗi)
- Trong Ranking: ngân hàng vẫn tham gia ranking bình thường

---

## BB-Boundary-3: Trend chart với 1 điểm dữ liệu

**Precondition**: Ngân hàng XYZ chỉ có 1 bản ghi Quarter=0 (Year=2024). Không có Quarter=1-4.

**Action**: Click vào XYZ trong Bank List.

**Expected**:
- Chart A: hiển thị 1 chấm tại Year=2024 — không có đường nối, không crash
- Chart B: ẩn + hiển thị "Chưa có dữ liệu báo cáo quý"

---

## BB-Boundary-4: Chưa chọn ngân hàng

**Precondition**: Trang vừa load, chưa click row nào.

**Action**: Quan sát khu vực Trend.

**Expected**:
- Khu vực Trend hiển thị placeholder: "Chọn một ngân hàng từ danh sách để xem xu hướng" (hoặc tương tự)
- Không hiển thị biểu đồ trống, không crash

---

## BB-Boundary-5: Ngân hàng chỉ có dữ liệu quý (không có báo cáo năm)

**Precondition**: Ngân hàng ABC có Quarter=1,2,3,4 nhưng không có Quarter=0.

**Action**: Click ABC trong Bank List.

**Expected**:
- Chart A: ẩn + hiển thị "Chưa có dữ liệu báo cáo năm"
- Chart B: hiển thị bình thường với các điểm quý

---

## Kết quả thực tế

| Test Case | Pass / Fail | Ngày test | Ghi chú |
|-----------|-------------|-----------|---------|
| BB-Normal-1 | | | |
| BB-Normal-2 | | | |
| BB-Abnormal-1 | | | |
| BB-Abnormal-2 | | | |
| BB-Boundary-1 | | | |
| BB-Boundary-2 | | | |
| BB-Boundary-3 | | | |
| BB-Boundary-4 | | | |
| BB-Boundary-5 | | | |
