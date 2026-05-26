# Tính năng: Nhật ký & Đánh giá Quyết định Đầu tư (AI-assisted)

## Mục tiêu
Xây dựng một tab mới trong dashboard cho phép người dùng:
1. **Ghi lại** lý do đằng sau mỗi quyết định mua/bán chứng khoán tại thời điểm ra quyết định.
2. **Đánh giá lại** các quyết định cũ bằng AI dựa trên dữ liệu thị trường hiện tại, từ đó rút ra bài học để tránh sai lầm cũ và phát huy điểm mạnh trong các quyết định sau.

## Yêu cầu chi tiết

### 1. Tab "Quyết định của tôi" (Decision Journal)
- Thêm một tab mới trong dashboard, ví dụ tên "Quyết định của tôi" / "My Decisions".
- Mỗi entry (quyết định) gồm tối thiểu các trường:
  - Mã chứng khoán (ticker)
  - Loại quyết định: Mua / Bán / Giữ / Quan sát
  - Ngày & giờ ra quyết định
  - Giá tại thời điểm ra quyết định
  - Khối lượng (nếu có)
  - **Kế hoạch quản trị rủi ro** (risk management plan) — định nghĩa rõ trước khi vào lệnh:
    - **Stop-loss**: ngưỡng giá giảm sẽ cắt lỗ (giá tuyệt đối hoặc % so với giá vào lệnh).
    - **Take-profit**: ngưỡng giá tăng sẽ chốt lời (giá tuyệt đối hoặc % so với giá vào lệnh). Có thể nhiều mốc (TP1, TP2, TP3) kèm tỉ trọng chốt tại mỗi mốc.
    - **Kế hoạch DCA / mua thêm**: nếu giá xuống tới ngưỡng nào thì mua thêm bao nhiêu (giá ngưỡng + khối lượng / tỉ trọng).
    - **Kế hoạch trailing stop / giữ**: nếu giá tăng đạt mốc nào thì dời stop-loss lên đâu, hoặc tiếp tục giữ với điều kiện gì.
    - **Tỉ trọng tối đa** dành cho mã này trong danh mục (%).
    - Các ngưỡng này sẽ được AI đối chiếu với diễn biến giá thực tế khi đánh giá: đã chạm stop-loss / take-profit chưa, người dùng có tuân thủ kế hoạch không.
  - **Lý do ra quyết định** (text dài — đây là phần quan trọng nhất, dùng làm input cho AI đánh giá)
  - Mức độ tự tin / tâm trạng tại thời điểm đó (tùy chọn)
  - Nguồn thông tin tham khảo (tùy chọn)
- Hỗ trợ thêm / sửa / xoá entry.
- Hiển thị danh sách entry theo timeline, có filter theo mã, theo loại quyết định, theo khoảng thời gian.

### 2. Đánh giá quyết định cũ bằng AI (AI Review)
- Mỗi entry có nút **"Đánh giá"**. Khi người dùng nhấn:
  - Hệ thống tổng hợp context gồm: nội dung entry (lý do, loại quyết định, giá lúc đó), diễn biến giá kể từ thời điểm đó tới hiện tại (% thay đổi, đỉnh / đáy trong khoảng đó, biến động ngành / VN-Index).
  - Gửi context này tới AI để sinh ra đánh giá có cấu trúc:
    - **Kết luận**: Quyết định Đúng / Sai / Chưa rõ (kèm lý do).
    - **Điểm hợp lý** trong lập luận gốc của người dùng.
    - **Điểm yếu / sai lầm** trong lập luận hoặc trong cách ra quyết định (ví dụ: thiên kiến FOMO, bỏ qua tín hiệu vĩ mô, đặt stop-loss sai…).
    - **Bài học rút ra** — ngắn gọn, có thể áp dụng cho lần sau.
- Lưu kết quả đánh giá vào DB, gắn với entry tương ứng, kèm timestamp đánh giá (vì cùng một entry có thể được đánh giá lại ở thời điểm khác và cho kết luận khác).
- Cho phép người dùng tự ghi chú / chỉnh sửa thêm bài học bên cạnh đánh giá của AI.

### 3. Dashboard tổng kết
- Tỉ lệ quyết định Đúng / Sai theo thời gian (dựa trên các đánh giá AI gần nhất).
- Tổng hợp các **pattern sai lầm lặp lại** (do AI gộp lại từ nhiều bài học) → cần tránh.
- Tổng hợp các **pattern thành công** → cần phát huy.

## Lưu ý kỹ thuật
- Stack hiện tại: React (frontend) + Express (backend) + MySQL.
- Cần migration tạo bảng mới: `decision_journal`, `decision_review` (1 entry → nhiều review).
- Tích hợp AI: cần quyết định provider (ví dụ Claude API) và prompt template chuẩn để output JSON cấu trúc (kết luận, điểm hợp lý, điểm yếu, bài học).
- Đa ngôn ngữ (i18n) đã có — đảm bảo các string UI mới đều được dịch.
