# Specification Sources — init-web-dashboard

## Danh sách nguồn

| # | File | Loại | Mức độ authoritative | Ghi chú |
|---|------|------|----------------------|---------|
| S1 | `discription.txt` | Requirements | **Authoritative** | Tài liệu yêu cầu chính do owner cung cấp |
| S2 | `database/create_table.sql` | DB Schema | **Authoritative** | Schema bảng `bctc_new` — nguồn dữ liệu chính của dashboard |
| S3 | `database/cal_diem.sql` | Business Logic | **Authoritative** | Logic chấm điểm & ranking ngân hàng |
| S4 | `database/TRIGGER.sql` | Business Logic | **Authoritative** | Công thức tính NPL, LDR, LLR, TangTruongDoanhThu — trigger đã được áp dụng đúng trên `bctc_new` |
| S5 | `database/db.ts` | Data Access | Reference ⚠️ (xem M2) | Logic INSERT/UPSERT vào bctc_new — hardcode derived values = 0 |
| S6 | `database/migrations/refactor-004-add-created-at.sql` | DB Migration | Reference | Thêm `created_at`/`updated_at` vào `bctc_new` |
| S7 | `database/migrations/create_bctc_crawl_log.sql` | DB Schema | Reference | Schema bảng crawl log — không liên quan trực tiếp đến dashboard UI |

---

## Mâu thuẫn & Điểm bất nhất

### M1 — ~~TRIGGER.sql trỏ sai bảng~~ (ĐÃ XÁC MINH — ĐÓNG)

- **Kết quả xác minh**: Trigger `updateValue` đã tồn tại trên `bctc_new` (xác nhận qua `SHOW TRIGGERS`). File `TRIGGER.sql` trong repo là script tạo ban đầu cho bảng `bctc`; trigger thực tế đã được tạo lại trên `bctc_new`.
- **Trạng thái**: Không còn là mâu thuẫn. Trigger hoạt động đúng.

### M2 — db.ts hardcode 4 chỉ số derived = 0 khi INSERT (ĐÃ XÁC MINH — CÒN TỒN TẠI)

- **Root cause xác nhận**: Trigger `updateValue` là `BEFORE UPDATE`. `db.ts` dùng `INSERT ... ON DUPLICATE KEY UPDATE`:
  - **Lần INSERT đầu tiên** (record chưa tồn tại): trigger KHÔNG kích hoạt → NPL/LLR/LDR/TangTruongDoanhThu = 0 được ghi vào DB.
  - **Lần INSERT thứ 2 trở đi** (ON DUPLICATE KEY → chuyển thành UPDATE): trigger kích hoạt → giá trị được tính đúng.
- **Bằng chứng từ DB** (Q1/2026):
  - Đã có giá trị thực: CTG, VCB, VPB (đã được crawl ≥ 2 lần).
  - Còn = 0 dù có raw data: BID (LDR nên là ~113.5%), LPB (NPL nên là ~0.74%), TCB (LLR nên là ~154%).
- **Hệ quả cho dashboard**: Một phần dữ liệu trong kỳ mới nhất có thể hiển thị 0 thay vì giá trị thực.
- **Cần quyết định**: Fix ở tầng data pipeline (chạy UPDATE sau INSERT) hay tính toán on-the-fly ở tầng API?

### M3 — cal_diem.sql không filter theo Year/Quarter

- **Vấn đề**: Query ranking (`cal_diem.sql`) không có mệnh đề WHERE, SELECT * từ toàn bộ `bctc_new`.
- **Hệ quả**: Nếu bảng có dữ liệu nhiều kỳ (Q1/2024, Q2/2024, Q3/2024...), ranking sẽ mix ngân hàng từ các kỳ khác nhau, cho kết quả không có ý nghĩa.
- **Câu hỏi cần trả lời**: Ranking áp dụng cho kỳ nào? Chỉ kỳ mới nhất, hay dùng như hiện tại?

---

## Tài liệu còn thiếu (Missing)

Các tài liệu sau chưa tồn tại và sẽ cần quyết định trước hoặc trong quá trình implementation:

| # | Tài liệu cần thiết | Ảnh hưởng |
|---|--------------------|-----------|
| D1 | UI/UX mockup / wireframe | Không rõ layout, thứ tự hiển thị, kiểu biểu đồ |
| D2 | ~~Tech stack frontend~~ | ✅ Đã quyết định: **React** |
| D3 | ~~Tech stack backend/API~~ | ✅ Đã quyết định: **Node.js + Express** |
| D4 | Authentication/Authorization | Chưa rõ dashboard có cần login không |
| D5 | Deployment environment | Local only / Docker / Cloud? |
| D6 | Performance/SLA | Không có yêu cầu về tải, response time |
