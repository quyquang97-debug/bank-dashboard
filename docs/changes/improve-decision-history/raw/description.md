# Yêu cầu cải thiện màn hình Lịch sử Quyết định

## 1. Thêm quyết định: đổi từ "tỉ trọng" sang "số lượng cổ phiếu"

**Vấn đề:** Trường nhập "tỉ trọng" không rõ nghĩa — tỉ trọng so với tổng tài sản, hay so với danh mục?

**Giải pháp:** Thay trường tỉ trọng (%) bằng trường **số lượng cổ phiếu mua** (số nguyên) và số tiền mua (đơn vị: VNĐ).

---

## 2. Đánh giá quyết định: thiếu giá thị trường tại thời điểm đánh giá

**Vấn đề:** Khi người dùng đánh giá lại một quyết định cũ, hệ thống không lấy được giá hiện tại của tài sản, dẫn đến tính toán lãi/lỗ bị sai hoặc trống.

**Giải pháp:** Gọi API giá vào thời điểm người dùng mở form đánh giá, hiển thị giá thị trường hiện tại trước khi lưu kết quả đánh giá.

---

## 3. Icon trong ô nhập liệu: đổi màu đen sang màu trắng

**Vấn đề:** Các icon bên trong text box (ví dụ: icon lịch trong bộ lọc ngày) đang hiển thị màu đen, trông không hài hòa với giao diện tối.

**Giải pháp:** Đổi màu icon thành trắng (`#FFFFFF` hoặc `white`) cho tất cả icon nằm trong ô nhập liệu.

---

## 4. Loại tài sản: mở rộng ngoài cổ phiếu

**Vấn đề:** Hiện tại form chỉ cho phép chọn cổ phiếu, không hỗ trợ các loại tài sản khác.

**Giải pháp:** Thêm các loại tài sản sau vào dropdown "Loại tài sản":
- Cổ phiếu *(hiện có)*
- Vàng
- Tiền ảo (Crypto)
- Gửi tiết kiệm
