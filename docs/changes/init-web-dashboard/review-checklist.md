# Review Checklist — init-web-dashboard

**Version**: 2.0 (Phase 4)  
**Date**: 2026-05-08  
**Supersedes**: draft-1.0 (Phase 2)

Checklist để review PR/diff trước khi merge. Gắn severity cho từng mục:
- **[Blocker]** — lỗi phải fix trước khi merge; sai spec, crash, security vuln, data sai
- **[Major]** — lỗi ảnh hưởng user rõ ràng hoặc vi phạm convention đã thống nhất
- **[Minor]** — code quality, logging, UX nhỏ — nên fix nhưng không block merge

---

## 1. Specification / Acceptance Criteria

### 1.1 Feature 1 — Bank List

| # | Severity | Check | AC |
|---|----------|-------|----|
| 1.1.1 | **[Blocker]** | `detectWindow(today)` được gọi; nếu trả về null thì fallback `MAX(Year*10+Quarter)` trong DB | AC-1 |
| 1.1.2 | **[Blocker]** | Mỗi hàng có đủ 6 cột: StockCode, NPL(%), LLR(%), LDR(%), TangTruongDoanhThu(%), Điểm Tổng | AC-2 |
| 1.1.3 | **[Major]** | Danh sách sắp xếp theo `total_diem DESC` (ngân hàng điểm cao nhất ở đầu) | AC-2b |
| 1.1.4 | **[Blocker]** | Khi `bctc_new` rỗng → hiển thị "Không có dữ liệu", không crash, không bảng trống không chú thích | AC-3 |
| 1.1.5 | **[Major]** | Cell với giá trị NULL → hiển thị `"—"` (không phải `"0"`, không phải blank, không lỗi) | AC-4 |
| 1.1.6 | **[Major]** | Cell với giá trị `0` (valid) → hiển thị `"0.00%"` (không phải `"—"`) | AC-4, Boundary-2 |

### 1.2 Feature 2 — YoY Trend

| # | Severity | Check | AC |
|---|----------|-------|----|
| 1.2.1 | **[Blocker]** | Khi chọn ngân hàng → hiển thị 2 biểu đồ riêng: Chart A (Quarter=0), Chart B (Quarter=1–4) | AC-5 |
| 1.2.2 | **[Major]** | Chart A trục X = `Year` (số nguyên); Chart B trục X = `{Year}Q{Quarter}`, tăng dần theo (Year, Quarter) | AC-6 |
| 1.2.3 | **[Major]** | Mỗi biểu đồ hiển thị đúng 5 đường: NPL, LLR, LDR, TangTruongDoanhThu, total_diem | AC-7 |
| 1.2.4 | **[Major]** | Toggle từng đường hoạt động; mặc định tất cả 5 đường bật | AC-7 |
| 1.2.5 | **[Blocker]** | Không có dữ liệu Quarter=0 → ẩn Chart A + hiển thị "Chưa có dữ liệu báo cáo năm", không crash | AC-8 |
| 1.2.6 | **[Blocker]** | Không có dữ liệu Quarter=1–4 → ẩn Chart B + hiển thị "Chưa có dữ liệu báo cáo quý", không crash | AC-8 |
| 1.2.7 | **[Major]** | Chưa chọn ngân hàng → khu vực trend hiển thị placeholder "Chọn một ngân hàng từ danh sách để xem xu hướng" | AC-9-trend |
| 1.2.8 | **[Minor]** | Trend với chỉ 1 điểm dữ liệu → hiển thị chấm đơn, không có đường nối, không crash | Boundary-3 |

### 1.3 Feature 3 — Cross-Bank Ranking

| # | Severity | Check | AC |
|---|----------|-------|----|
| 1.3.1 | **[Blocker]** | RANK direction đúng theo `cal_diem.sql`: NPL DESC, LLR ASC, LDR DESC, TangTruongDoanhThu ASC | AC-10-rank |
| 1.3.2 | **[Blocker]** | Metric NULL → bỏ qua metric đó trong RANK (`CASE WHEN ... IS NULL THEN NULL`), không loại toàn bộ bank | AC-10-rank |
| 1.3.3 | **[Blocker]** | `total_diem = COALESCE(npl_diem,0)+COALESCE(llr_diem,0)+COALESCE(ldr_diem,0)+COALESCE(ttt_diem,0)` | AC-10-rank |
| 1.3.4 | **[Blocker]** | Ranking tính trên **toàn bộ** `bctc_new` — không filter theo kỳ | AC-10 |
| 1.3.5 | **[Major]** | Biểu đồ ranking sắp xếp `total_diem DESC` | AC-11 |
| 1.3.6 | **[Major]** | Khi chỉ có 1 ngân hàng trong DB → RANK=1 cho cả 4 metrics, total_diem=4 | AC-12 |

---

## 2. Design / Dependencies

| # | Severity | Check |
|---|----------|-------|
| 2.1 | **[Blocker]** | `detectWindow` là copy standalone trong `backend/src/lib/detectWindow.ts` — không import từ `bank-analysis` |
| 2.2 | **[Blocker]** | `detectWindow` body khớp với `bank-analysis/src/scheduler.ts` lines 19–61 (không biến tấu) |
| 2.3 | **[Major]** | DB connection dùng pool (`mysql2/promise` createPool) — không tạo connection mới mỗi request |
| 2.4 | **[Major]** | MySQL ≥ 8.0 đã được xác nhận (`SELECT VERSION()`) — RANK() OVER là window function yêu cầu 8.0+ |
| 2.5 | **[Minor]** | Không có circular dependency giữa routes, db, lib |
| 2.6 | **[Minor]** | Frontend không có dependency nào ngoài React, Recharts, TypeScript, Vite |

---

## 3. Security

| # | Severity | Check |
|---|----------|-------|
| 3.1 | **[Blocker]** | DB credentials đọc từ `process.env` — không hardcode bất kỳ credential nào trong source |
| 3.2 | **[Blocker]** | File `.env` không bị commit vào git (phải có trong `.gitignore`) |
| 3.3 | **[Blocker]** | `:code` trong `GET /api/banks/:code/trend` được validate trước khi dùng trong SQL (`/^[A-Z]{2,4}$/`) |
| 3.4 | **[Blocker]** | Không có SQL injection — toàn bộ user input được truyền qua parameterized query (`?` placeholder) |
| 3.5 | **[Major]** | CORS chỉ cho phép `http://localhost:5173` — không dùng wildcard `*` trong production config |
| 3.6 | **[Minor]** | Response không lộ stack trace hay nội dung lỗi DB chi tiết ra client |

---

## 4. Performance

| # | Severity | Check |
|---|----------|-------|
| 4.1 | **[Major]** | `GET /api/banks` response time < 3 giây trên kết nối bình thường (NFR-1) |
| 4.2 | **[Major]** | CTE + RANK() OVER không gây full table scan không cần thiết — kiểm tra EXPLAIN nếu > 1 giây |
| 4.3 | **[Minor]** | Frontend không gọi API lại khi không cần thiết (ví dụ: không re-fetch banks mỗi render) |
| 4.4 | **[Minor]** | Pool connection limit phù hợp (10 mặc định đủ cho dev/single user) |

---

## 5. Compatibility

| # | Severity | Check |
|---|----------|-------|
| 5.1 | **[Blocker]** | Layout không vỡ ở viewport rộng 1280px (NFR-2) |
| 5.2 | **[Major]** | Recharts render đúng khi array chỉ có 1 phần tử (dot hiện, không crash) |
| 5.3 | **[Minor]** | TypeScript strict mode — `tsc --noEmit` không có lỗi |
| 5.4 | **[Minor]** | Node.js ≥ 18 — không dùng API chỉ có ở 20+ |

---

## 6. Logs / Audit

| # | Severity | Check |
|---|----------|-------|
| 6.1 | **[Minor]** | Server log khi khởi động: port đang lắng nghe (ví dụ: `Backend running on :3001`) |
| 6.2 | **[Minor]** | Không có `console.log` debug còn sót trong production code |
| 6.3 | **[Minor]** | Lỗi DB (pool timeout, query error) được log ở server — không nuốt lỗi im lặng |

---

## 7. Error Handling

| # | Severity | Check |
|---|----------|-------|
| 7.1 | **[Blocker]** | API trả `{ "error": "DESCRIPTION" }` + HTTP 4xx/5xx khi có lỗi (không trả 200 với empty body) |
| 7.2 | **[Blocker]** | `GET /api/banks/:code/trend` với code không hợp lệ → 400 Bad Request |
| 7.3 | **[Major]** | `GET /api/banks/:code/trend` khi không có dữ liệu → 404, không crash |
| 7.4 | **[Major]** | Frontend hiển thị "Lỗi tải dữ liệu" khi API call thất bại — không để trang trắng/crash |
| 7.5 | **[Major]** | Frontend xử lý loading state — hiển thị "Đang tải…" trong khi fetch đang chạy |
| 7.6 | **[Minor]** | DB connection error khi khởi động → server log rõ ràng, không crash silently |

---

## 8. Testing

| # | Severity | Check |
|---|----------|-------|
| 8.1 | **[Blocker]** | Smoke test S16 đã được chạy và kết quả ghi vào `test-results.md` |
| 8.2 | **[Major]** | Normal-1 (5 banks) — bảng hiển thị đúng giá trị |
| 8.3 | **[Major]** | Normal-2 (VCB trend) — Chart A có Year axis, Chart B có `{Year}Q{Quarter}` axis |
| 8.4 | **[Major]** | Abnormal-1 (DB rỗng) — cả 3 section hiển thị "Không có dữ liệu" |
| 8.5 | **[Major]** | Abnormal-2 (NULL metric) — "—" trong table, NPL_diem=NULL không ảnh hưởng bank khác |
| 8.6 | **[Major]** | Boundary-1 (1 bank) — total_diem=4, không crash |
| 8.7 | **[Minor]** | Boundary-2 (TangTruongDoanhThu=0) — hiển thị "0.00%", không phải "—" |
| 8.8 | **[Minor]** | Boundary-3 (1 data point) — chấm đơn render, không crash |

---

## 9. Operations

| # | Severity | Check |
|---|----------|-------|
| 9.1 | **[Blocker]** | `.env.example` tồn tại ở project root và có đủ 6 biến: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `VITE_API_BASE_URL` |
| 9.2 | **[Major]** | `README.md` hoặc tài liệu tương đương mô tả cách chạy dev: `npm install`, tạo `.env`, `npm run dev` |
| 9.3 | **[Minor]** | Backfill P1 (BID, LPB, TCB, MBB, STB) đã chạy hoặc được ghi nhận là chưa chạy trong `test-results.md` |
| 9.4 | **[Minor]** | `db.ts` fix (OI-2b) trạng thái được ghi nhận — đã merge vào `bank-analysis` hay vẫn pending |

---

## 10. AC Mapping Table

Bảng tổng hợp: mỗi AC được xác nhận bởi check nào.

| AC | Checks xác nhận |
|----|----------------|
| AC-1 | 1.1.1 |
| AC-2 | 1.1.2 |
| AC-2b | 1.1.3 |
| AC-3 | 1.1.4, 8.4 |
| AC-4 | 1.1.5, 1.1.6, 8.5 |
| AC-5 | 1.2.1 |
| AC-6 | 1.2.2 |
| AC-7 | 1.2.3, 1.2.4 |
| AC-8 | 1.2.5, 1.2.6 |
| AC-9-trend | 1.2.7 |
| AC-10-rank | 1.3.1, 1.3.2, 1.3.3 |
| AC-10 | 1.3.4 |
| AC-11 | 1.3.5 |
| AC-12 | 1.3.6, 8.6 |
