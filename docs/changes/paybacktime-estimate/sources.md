# Sources — paybacktime

**Ticket**: Tích hợp tab "Định Giá" (Valuation) vào web dashboard  
**Date**: 2026-05-10

---

## 1. Danh sách nguồn tài liệu

| ID | Tài liệu | Đường dẫn | Loại | Mức độ tin cậy |
|----|----------|-----------|------|----------------|
| S1 | Ticket description | `docs/changes/paybacktime/raw/discription.md` | Yêu cầu chức năng | **Authoritative** — nguồn duy nhất về yêu cầu |
| S2 | Architecture overview | `docs/architecture/overview.md` | Thiết kế hệ thống | **Authoritative** — mô tả hệ thống hiện tại |
| S3 | `runPaybacktime.ts` | `paybacktime/runPaybacktime.ts` | Code hiện tại | **Authoritative** — API thực tế của hàm tính MOS |
| S4 | `PayBacktime.ts` | `paybacktime/PayBacktime.ts` | Code hiện tại | **Authoritative** — danh sách stock mặc định + tham số |
| S5 | `saveMos.ts` | `database/saveMos.ts` | Code hiện tại | **Authoritative** — logic upsert vào bảng `paybacktime` |
| S6 | `create_table.sql` | `database/create_table.sql` | DDL | **Authoritative** — schema chính xác của bảng `paybacktime` |
| S7 | `App.tsx` | `frontend/src/App.tsx` | Code hiện tại | **Authoritative** — layout hiện tại (scroll, chưa có tab) |
| S8 | Backend routes | `backend/src/routes/*.ts` | Code hiện tại | **Authoritative** — pattern đặt route hiện tại |

---

## 2. Mâu thuẫn và điểm cần lưu ý

| ID | Giữa nguồn nào | Nội dung mâu thuẫn | Phán định |
|----|---------------|--------------------|-----------|
| C-1 | S1 vs S3 | Ticket nói "gọi `runPaybacktime` với danh sách ngân hàng mặc định và `calMos` (8 năm)". Tuy nhiên `runPaybacktime` (S3) nhận `calMosFn` là tham số — không có default nội bộ. Backend phải tự import `calMos` từ `paybacktime/CalMos.ts` và truyền vào. | Resolve theo S3 (code là source of truth). Backend cần import và truyền tường minh. |
| C-2 | S1 (mô tả flow) | Ticket mô tả flow: POST → đợi → GET. Nhưng `runPaybacktime` gọi `Promise.all` cho 17 ngân hàng, mỗi ngân hàng gọi external API (`GetTradeInfo`). Thời gian chạy có thể > 30 giây, gần ngưỡng timeout HTTP mặc định. | Open Issue — cần quyết định timeout policy (xem OI-1). |
| C-3 | S1 vs S1 | Ticket nói "mỗi lần chuyển sang tab Định Giá (bao gồm load lại tab)" — nhưng không nói rõ: nếu POST đang chạy mà user chuyển tab đi rồi quay lại, có hủy request cũ không, và có chặn run đồng thời không. | Open Issue (xem OI-2). |
| C-4 | S6 (DDL) | Bảng `paybacktime` có cả `created_at` và `updated_at`, cả hai đều DEFAULT CURRENT_TIMESTAMP. `saveMos.ts` (S5) chỉ SET `updated_at` trên DUPLICATE KEY UPDATE — `created_at` không cập nhật. Phù hợp — nhưng cần lưu ý: cột `created_at` phản ánh lần chạy đầu tiên, không phải lần cuối. | Không mâu thuẫn, nhưng cần ghi vào spec để tránh nhầm khi hiển thị. |

---

## 3. Tài liệu thiếu (Missing)

| Thiếu | Lý do cần | Ảnh hưởng |
|-------|-----------|-----------|
| Wireframe / mockup UI tab "Định Giá" | Ticket mô tả bằng chữ, không có hình. Format số (decimal places), responsive, màu sắc chưa rõ. | Có thể bắt đầu implement nhưng cần confirm UI trước khi demo. |
| Error handling spec cho `GetTradeInfo` | Nếu 1 ngân hàng lỗi (API ngoài trả lỗi), toàn bộ batch có fail không? | Liên quan đến OI-1. |
| Timeout policy cho POST | Không có SLA cho thời gian chạy. | Liên quan đến OI-1. |
