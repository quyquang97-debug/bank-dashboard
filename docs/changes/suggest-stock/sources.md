# Sources — suggest-stock (Tab "Sàng Lọc Cổ Phiếu")

**Version**: 1.0
**Date**: 2026-05-10
**Status**: DRAFT

---

## 1. List of Specification Sources

| # | Tài liệu | Đường dẫn | Vai trò | Độ tin cậy |
|---|----------|-----------|---------|------------|
| S1 | Ticket description | `docs/changes/suggest-stock/raw/description.md` | **Authoritative — yêu cầu gốc, mô tả đầy đủ feature, công thức, API, UI** | Authoritative |
| S2 | Spec Pack — init-web-dashboard | `docs/changes/init-web-dashboard/spec-pack.md` | Context — As-Is hệ thống, AC gốc Phase 1 | Authoritative cho As-Is |
| S3 | Spec Pack — paybacktime-estimate | `docs/changes/paybacktime-estimate/spec-pack.md` | Context — tab "Định Giá", convention spec | Authoritative cho convention |
| S4 | Spec Pack — filter-by-year-quarter | `docs/changes/filter-by-year-quarter/spec-pack.md` | Context — `PeriodFilter`, semantics `quarter=0` | Authoritative cho period semantics |
| S5 | Backend source — routes | `backend/src/routes/ranking.ts`, `valuation.ts`, `periods.ts`, `index.ts` | Authoritative — current API behavior, response shape | Authoritative |
| S6 | Frontend source | `frontend/src/App.tsx`, `api/client.ts`, `components/PeriodFilter.tsx`, `components/ValuationTab.tsx` | Authoritative — tab navigator, fetcher conventions | Authoritative |

---

## 2. Nội dung Authoritative từ S1 (Ticket)

S1 cung cấp đầy đủ:
- Feature name, vị trí UI (tab thứ 3)
- Công thức tính `S_rank`, `S_val`, `Score`, ngưỡng tín hiệu (MUA/GIỮ/TRÁNH)
- API spec: `GET /api/screening?year=&quarter=`, response schema chi tiết
- Frontend spec: component `ScreeningTab.tsx`, dùng `PeriodFilter` hiện có
- Constraints: không thêm DB table, không LLM, không sửa tab cũ

---

## 3. Mâu thuẫn / Khoảng trống giữa các nguồn

| # | Mô tả | Nguồn liên quan | Trạng thái |
|---|-------|----------------|------------|
| GAP-1 | S1 nói rõ "valuation hiện chỉ có snapshot mới nhất, không theo kỳ — phase này chấp nhận dùng giá trị hiện tại bất kể kỳ được chọn". Hệ quả: `s_val` không thay đổi khi user đổi kỳ; chỉ `s_rank` (và do đó `score`) thay đổi. **Không phải mâu thuẫn**, nhưng cần highlight rõ trong spec để tránh hiểu lầm. | S1 | Documented (Spec §4 As-Is/To-Be) |
| GAP-2 | Công thức `S_rank = (totalDiem - min) / (max - min) × 100` không định nghĩa hành vi khi `max == min` (chia 0). | S1 | OI-1 → đã đóng (xem spec) |
| GAP-3 | Mã có trong ranking (kỳ chọn) nhưng không có trong valuation snapshot (`ti_i` null) — S1 không nói loại bỏ hay giữ. | S1 | OI-2 → đã đóng (loại khỏi kết quả) |
| GAP-4 | Threshold MUA=65, GIỮ=40 hardcode trong S1 — cần file constant riêng để dễ chỉnh. | S1 | OI-4 → đã đóng (file `screeningConfig.ts`) |
| GAP-5 | "Mặc định chọn kỳ mới nhất" — chưa định nghĩa cách xác định "mới nhất". | S1 vs S5 (`/api/periods` order) | Spec hóa: dùng phần tử đầu tiên của `fetchPeriods()` (đã sort DESC bởi route hiện có) |
| GAP-6 | Tie-breaker khi nhiều mã có `score` bằng nhau — S1 không nêu. | S1 | Spec hóa: secondary sort theo `stockCode` ASC |
| GAP-7 | Format hiển thị các điểm số (`s_rank`, `s_val`, `score`) — số nguyên hay decimal. | S1 | Spec hóa: 2 decimal (đồng nhất convention với `paybacktime-estimate`) |
| GAP-8 | Schema `totalDiem` (INT vs DECIMAL) ảnh hưởng precision của normalization — memory note đã flag. | S5 | OI-5 (open) — cần kiểm chứng schema thực tế trước impl |

---

## 4. Tài liệu Missing (cần cung cấp nếu có)

Tại thời điểm tạo spec, các tài liệu sau **không được cung cấp** qua `@` reference:

- **Wireframe / mockup UI** cho tab "Sàng Lọc" — chưa có; spec sẽ mô tả layout bằng text + bảng cột
- **Meeting notes / decision log** riêng cho feature này — chưa có
- **DDL của bảng ranking** (xác nhận type `totalDiem`) — chưa có; sẽ note thành OI-5
- **Data sample** thực tế của `/api/ranking/history` và `/api/valuation` (giá trị min/max của `totalDiem`, phân bố `ti_suat_sinh_loi`) — chưa có; ảnh hưởng đến việc estimate edge cases nhưng không chặn spec
- **NFR cụ thể** (số mã tối đa kỳ vọng, response time SLA) — chưa có; spec sẽ dùng default conservative

Việc thiếu các tài liệu này **không chặn** việc tạo Spec Pack, nhưng cần được giải quyết hoặc xác nhận trước khi bắt đầu implementation (đặc biệt OI-5 về schema).
