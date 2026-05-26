# Sources of Truth — Improve Decision History

**Ticket**: Yêu cầu cải thiện màn hình Lịch sử Quyết định  
**Version**: 1.0  
**Date**: 2026-05-26

---

## 1. Danh sách tài liệu

| # | Tài liệu | Đường dẫn | Mức độ authority | Ghi chú |
|---|----------|-----------|-----------------|---------|
| S-1 | Ticket mô tả yêu cầu | `docs/changes/improve-decision-history/raw/description.md` | **PRIMARY** — authoritative cho yêu cầu chức năng | Nguồn duy nhất, do owner viết |
| S-2 | Spec Pack của ticket trước (decision-history-and-evaluation) | `docs/changes/descision-history-and-evaluation/spec-pack.md` | **REFERENCE** — mô tả As-Is sau khi Phase 1 đã implement | Cần đọc để hiểu hiện trạng schema + API |
| S-3 | Implementation hiện tại: Backend routes | `backend/src/routes/decisions.ts` | **REFERENCE** — ground truth về behavior thực tế | Cần đọc kỹ để hiểu gap với S-2 |
| S-4 | Implementation hiện tại: Frontend form | `frontend/src/components/decisions/DecisionForm.tsx` | **REFERENCE** — hiển thị field `volume` hiện tại | Trường `volume` hiện là % danh mục (0–100) |
| S-5 | Implementation hiện tại: Frontend detail | `frontend/src/components/decisions/DecisionDetail.tsx` | **REFERENCE** — icon và UX review flow | Xác nhận icon màu đen trong dark UI |
| S-6 | Price service | `backend/src/lib/priceService.ts` | **REFERENCE** — phạm vi hỗ trợ ticker hiện tại | Chỉ hỗ trợ mã chứng khoán Vietstock |
| S-7 | AI service | `backend/src/lib/aiService.ts` | **REFERENCE** — prompt template hiện tại | Prompt dùng `volume` là % danh mục |
| S-8 | Locale files | `frontend/src/locales/{vi,en,ja}.json` | **REFERENCE** — keys hiện có | Key `decisions.form.volume` = "Tỉ trọng danh mục (%)" |

---

## 2. Mâu thuẫn và điểm cần chú ý

| ID | Mâu thuẫn / Điểm mơ hồ | Tài liệu liên quan | Trạng thái |
|----|------------------------|-------------------|-----------|
| C-1 | S-1 nói đổi "tỉ trọng" → "số lượng cổ phiếu" + "số tiền mua". Không rõ `buy_amount` là trường **nhập tay** hay **tính toán** (`quantity × entry_price`). | S-1 | **Open Issue** → OI-1 |
| C-2 | S-1 nói thêm loại tài sản (Vàng, Crypto, Tiết kiệm), nhưng S-6 (priceService) chỉ hỗ trợ Vietstock — không có nguồn giá cho Vàng/Crypto/Tiết kiệm. | S-1, S-6 | **Open Issue** → OI-3 |
| C-3 | S-1 nói "hiển thị giá thị trường hiện tại trước khi lưu kết quả đánh giá" nhưng không rõ UX cụ thể: giá hiển thị ở đâu? Trong modal? Là readonly? Cần confirm từ user? | S-1 | **Open Issue** → OI-2 |
| C-4 | Nếu đổi `volume` → `quantity` + `buy_amount`, dữ liệu cũ đang lưu `volume` = % danh mục sẽ bị mất nghĩa. Cần chiến lược migration. | S-1, S-2, S-3 | **Open Issue** → OI-4 |
| C-5 | Với loại tài sản Vàng/Crypto: `stop_loss`, `take_profit`, `risk_plan` còn có ý nghĩa không? Tiết kiệm (lãi suất cố định) thì sao? | S-1 | **Open Issue** → OI-5 |
| C-6 | S-1 nói "icon trong ô nhập liệu" — không rõ giới hạn phạm vi (chỉ `<input type="datetime-local">` hay tất cả icon trong text box)? | S-1, S-5 | Có thể tự giải quyết bằng CSS toàn cục; ghi nhận để xác nhận scope |
