## Mục tiêu
Tích hợp tính năng định giá ngân hàng (từ folder /paybacktime) vào web dashboard hiện tại bằng cách thêm tab "Định Giá" vào navigator.

---

## Hiện trạng
- Frontend (React/Vite) tại frontend/src/App.tsx hiện hiển thị 3 section dạng scroll: Danh Sách Ngân Hàng, Xu Hướng, Xếp Hạng.
- Backend (Express) tại backend/src/index.ts, các route trong backend/src/routes/.
- Logic định giá nằm ở folder /paybacktime (entry point: PayBacktime.ts, chạy qua runPaybacktime.ts), lưu kết quả vào bảng MySQL `paybacktime` (8 năm) và `paybacktime6year` (6 năm).
- Bảng `paybacktime` có các cột: StockCode, MOS, current_price, ti_suat_sinh_loi, updated_at.

---

## Yêu cầu thay đổi

### 1. Frontend – Chuyển layout từ scroll sang tab navigator
Thêm tab navigator vào App.tsx với 2 tab:
- **"Xếp Hạng"** – giữ nguyên toàn bộ nội dung hiện tại (BankList, TrendChart, RankingChart).
- **"Định Giá"** – tab mới, nội dung mô tả ở mục 2.

### 2. Frontend – Tab "Định Giá"
Khi người dùng chuyển sang tab "Định Giá":
1. Frontend gọi API `POST /api/valuation/run` để trigger backend chạy lại toàn bộ logic tính MOS cho tất cả ngân hàng (giống như chạy `npm run paybacktime`).
2. Sau khi backend trả về, frontend gọi `GET /api/valuation` để lấy danh sách kết quả từ bảng `paybacktime`.
3. Hiển thị danh sách dưới dạng bảng, sắp xếp giảm dần theo `ti_suat_sinh_loi` (tỉ suất sinh lời = MOS / current_price).
4. Các cột hiển thị: STT, Mã CK (StockCode), Giá Hiện Tại (current_price), Giá Trị Nội Tại/MOS (MOS), Tỉ Suất Sinh Lời (ti_suat_sinh_loi, format %), Cập Nhật Lúc (updated_at).

Mỗi lần người dùng chuyển sang tab "Định Giá" (bao gồm load lại tab), hệ thống tự động chạy lại bước 1 và 2 ở trên.

### 3. Backend – API mới
Thêm 2 route mới vào backend/src/routes/ (đặt tên file: valuation.ts):
- `POST /api/valuation/run`: Gọi hàm `runPaybacktime` từ /paybacktime/runPaybacktime.ts với danh sách ngân hàng mặc định và `calMos` (8 năm). Đợi hoàn thành rồi trả về `{ success: true }`.
- `GET /api/valuation`: Query bảng `paybacktime`, trả về toàn bộ rows sắp xếp theo `ti_suat_sinh_loi DESC`.

---

## Lưu ý kỹ thuật
- Trong lúc `POST /api/valuation/run` đang chạy, frontend nên hiển thị trạng thái loading ("Đang tính toán định giá...").
- Không tạo thêm tab "6 năm" hay các biến thể khác trong lần này – chỉ dùng bảng `paybacktime` (8 năm).
- Không thay đổi logic trong folder /paybacktime, chỉ import và gọi hàm.
