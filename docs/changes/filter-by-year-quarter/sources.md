# Sources — filter-by-year-quarter

**Version**: 1.0  
**Date**: 2026-05-09  
**Status**: DRAFT

---

## 1. List of Specification Sources

| # | Tài liệu | Đường dẫn | Vai trò | Độ tin cậy |
|---|----------|-----------|---------|------------|
| S1 | Ticket description | `docs/changes/filter-by-year-quarter/raw/discription.txt` | **Authoritative — yêu cầu gốc** | Vague (1 dòng) |
| S2 | Spec Pack — init-web-dashboard | `docs/changes/init-web-dashboard/spec-pack.md` | Context — hệ thống hiện tại, AC gốc | Authoritative cho As-Is |
| S3 | Architecture Overview | `docs/architecture/overview.md` | Authoritative — DB schema, API flows, detectWindow | Authoritative |
| S4 | API Conventions | `docs/standards/api-conventions.md` | Authoritative — response shapes, naming | Authoritative |
| S5 | Frontend source (App.tsx, BankList.tsx, api/client.ts) | `frontend/src/` | Authoritative — current implementation state | Authoritative |
| S6 | Backend source (banks.ts, ranking.ts) | `backend/src/routes/` | Authoritative — current query logic | Authoritative |

---

## 2. Nội dung Authoritative từ S1 (Ticket)

> "Cho phép chọn năm và quý, đồng thời hiện UI tương ứng."

Đây là toàn bộ nội dung ticket. **Rất ngắn và mơ hồ.** Các điểm cần làm rõ:
- "Chọn năm và quý" → cả 2 bắt buộc cùng lúc hay có thể chọn từng cái?
- "Hiện UI tương ứng" → có thể hiểu là (a) hiển thị bộ lọc trên UI, hoặc (b) cập nhật data theo bộ lọc đã chọn
- Phạm vi ảnh hưởng không được nêu rõ: chỉ Bank List? Cả Ranking? Cả Trend?

---

## 3. Mâu thuẫn / Khoảng trống giữa các nguồn

| # | Mô tả | Nguồn liên quan | Cần quyết định |
|---|-------|----------------|----------------|
| GAP-1 | Ticket không nói phạm vi ảnh hưởng. Ranking hiện chạy trên **toàn bộ** `bctc_new` theo thiết kế `cal_diem.sql` (S2, S6). Nếu filter cũng ảnh hưởng Ranking → phá vỡ thiết kế gốc. | S1 vs S2/S6 | OI-1 |
| GAP-2 | Ticket không nói Trend có bị ảnh hưởng không. Trend đang hiện toàn bộ lịch sử — filter theo kỳ có thể gây confusing với chart nhiều điểm. | S1 vs S5/S6 | OI-2 |
| GAP-3 | "Chọn năm và quý" — không rõ có cho phép chọn Year-only (tất cả quý của năm đó) không. | S1 | OI-3 |
| GAP-4 | Không rõ UI component: dropdown, tab, radio button, hay dạng khác. | S1 | OI-5 |
| GAP-5 | Không rõ liệu danh sách (Year, Quarter) có để filter được lấy từ DB hay hardcode. | S1 | OI-4 |
| GAP-6 | Không rõ trạng thái mặc định khi tải trang: current period (logic `detectWindow`), hay period gần nhất trong DB, hay không có gì chọn. | S1 | OI-6 |
