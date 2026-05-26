# Specification Sources — Decision History & Evaluation

**Ticket**: Nhật ký & Đánh giá Quyết định Đầu tư (AI-assisted)
**Date**: 2026-05-24
**Phase**: 1 (Spec Pack)

---

## 1. Danh sách nguồn (Source of Truth)

| # | File / Reference | Loại | Mức độ authoritative | Ghi chú |
|---|------------------|------|----------------------|---------|
| S1 | [docs/changes/descision-history-and-evaluation/raw/description.md](raw/description.md) | Ticket description (do owner cung cấp) | **Authoritative** — nguồn yêu cầu chính | Mô tả mục tiêu, các trường dữ liệu, AI review flow, dashboard tổng kết |
| S2 | [docs/architecture/overview.md](../../architecture/overview.md) | Architecture baseline | **Authoritative** — context kỹ thuật | Stack hiện tại: React + Express + MySQL `finance.bctc_new`, no auth, public dashboard |
| S3 | [docs/standards/api-conventions.md](../../standards/api-conventions.md) | Conventions | **Authoritative** — API design rules | Shape `{ data, meta }`, NULL handling, env vars, CORS |
| S4 | [docs/standards/frontend-conventions.md](../../standards/frontend-conventions.md) | Conventions | **Authoritative** — FE design rules | React 18, Vite, Recharts, native fetch, no business logic in components |
| S5 | [docs/changes/init-web-dashboard/spec-pack.md](../init-web-dashboard/spec-pack.md) | Spec tiền nhiệm | Reference | Spec của dashboard hiện tại (3 tab: Bank List / Trend / Ranking). Quy ước viết spec để noi theo |
| S6 | [frontend/src/locales/](../../../frontend/src/locales/) | i18n keys | **Authoritative** | Đa ngôn ngữ đã có: `vi.json`, `en.json`, `ja.json`. Mọi string UI mới phải được dịch |
| S7 | [frontend/src/App.tsx](../../../frontend/src/App.tsx), [frontend/src/components/](../../../frontend/src/components/) | Existing UI | Reference | Cấu trúc tab hiện có: Bank List, Screening, Valuation, … để thêm tab mới |
| S8 | [backend/src/routes/](../../../backend/src/routes/) | Existing API | Reference | Pattern các route hiện có (banks, ranking, periods, screening, valuation) |

---

## 2. Mâu thuẫn (Conflicts)

Hiện tại **chưa phát hiện mâu thuẫn nội tại** giữa các nguồn trên. Tất cả conflict tiềm tàng đến từ thông tin còn thiếu trong ticket description — đã ghi nhận trong "Open Issues" của [spec-pack.md](spec-pack.md), không phải mâu thuẫn giữa nguồn.

---

## 3. Khoảng trống tài liệu — ĐÓNG (2026-05-24)

Tất cả đã được quyết định. Xem chi tiết trong [spec-pack.md §9 Open Issues](spec-pack.md).

| # | Hạng mục | Quyết định |
|---|----------|-----------|
| D1 | Nguồn dữ liệu giá | Vietstock (`tradinginfo` + `historicalquote`), cùng pattern `GetTradeInfo.ts` |
| D2 | AI provider | Claude API `claude-sonnet-4-6`, key `ANTHROPIC_API_KEY` |
| D3 | Auth / multi-user | Single-user, no auth |
| D4 | UI mockup | Tự thiết kế theo style dashboard hiện tại |
| D5 | risk_plan schema | JSON column |
| D6 | Re-evaluation | Review mới mỗi lần bấm, kèm `reviewed_at` |
| D7 | Pattern aggregation | Manual button "Tính pattern", AI tự quyết threshold |
| D8 | Performance / AI cost | No cap, single-user; budget < $10/tháng |
| D9 | Volume unit | % danh mục (DOUBLE) |
| D10 | Currency | VND, định dạng dấu phân cách nghìn |

---

## 4. Quy ước cho Spec Pack

- Ngôn ngữ tài liệu: **tiếng Việt** (đồng nhất với ticket description và spec tiền nhiệm `init-web-dashboard`).
- Đánh số AC: `AC-1`, `AC-2`, … theo thứ tự liên tục, không reset theo section.
- Đánh số Open Issue: `OI-1`, `OI-2`, … kèm severity (Blocker / Major / Minor).
- Đánh số Risk: `R-1`, `R-2`, …
