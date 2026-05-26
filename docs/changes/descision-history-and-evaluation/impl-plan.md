# Implementation Plan — Decision History & Evaluation

**Feature**: Nhật ký & Đánh giá Quyết định Đầu tư (AI-assisted)  
**Spec**: [spec-pack.md](spec-pack.md) v0.2 — Phase 1 FINAL  
**Version**: 1.0  
**Date**: 2026-05-24  
**Status**: READY FOR IMPLEMENTATION

---

## 1. Policy

### 1.1 Codebase conventions (bắt buộc tuân theo)

| Convention | Áp dụng |
|------------|---------|
| **ESM modules** | Tất cả import trong backend phải dùng `.js` extension (e.g. `import { pool } from "../db/connection.js"`) |
| **Strict TypeScript** | Không dùng `any` trừ mysql2 row casting; cast rõ ràng |
| **Router pattern** | Mỗi nhóm endpoint → 1 file `backend/src/routes/*.ts` export `Router`; đăng ký trong `index.ts` |
| **DB pool** | Import `pool` từ `db/connection.ts`; dùng `pool.execute()` |
| **Response shape** | `{ data, meta? }` cho success; `{ error: "CODE" }` cho lỗi — theo api-conventions.md |
| **camelCase JSON** | Tất cả response key là camelCase |
| **NULL pass-through** | Không coerce NULL → 0 ở API layer |
| **Env vars** | Tất cả secrets đọc từ `process.env`, không hardcode |
| **Frontend fetch** | Native `fetch` trong `api/client.ts`; không dùng axios ở FE |
| **No business logic in components** | Validate, compute → backend hoặc custom hooks; component chỉ render |
| **i18n** | Keys mới trong namespace `decisions.*`; đầy đủ 3 file (vi/en/ja) |
| **CSS** | CSS Modules hoặc plain CSS; không CSS-in-JS |
| **Component files** | `PascalCase.tsx`; hook files `use<Name>.ts` |

### 1.2 Constraint tuyệt đối

- Không implement gì ngoài spec-pack. Nếu phát sinh yêu cầu mới → mở Open Issue mới, không tự thêm.
- AI API key (`ANTHROPIC_API_KEY`) **không bao giờ** xuất hiện ở frontend hoặc git.
- Mọi call tới Claude API đều đi qua backend.

### 1.3 Lựa chọn implementation (so sánh phương án)

#### Pattern_cache storage
| Phương án | Ưu | Nhược |
|-----------|-----|-------|
| **A: Bảng riêng `decision_pattern_cache`** (chọn) | Không ảnh hưởng schema hiện có; dễ query `ORDER BY computed_at DESC LIMIT 1`; rõ ràng | Thêm 1 bảng |
| B: Field JSON trong `app_settings` | Không cần bảng mới | Cần tạo `app_settings` trước; coupling lạ |

→ **Chọn A**: bảng `decision_pattern_cache(id, computed_at, result JSON)`.

#### AI client library
| Phương án | Ưu | Nhược |
|-----------|-----|-------|
| **A: `@anthropic-ai/sdk` npm package** (chọn) | Official SDK, type-safe, retry built-in | Thêm dependency |
| B: raw `axios` POST | Đã có axios | Không type-safe, phải tự handle auth header |

→ **Chọn A**: install `@anthropic-ai/sdk`.

#### Decision API client (frontend)
| Phương án | Ưu | Nhược |
|-----------|-----|-------|
| **A: Thêm vào `api/client.ts`** (chọn) | Đồng nhất với pattern hiện tại | File lớn hơn |
| B: File riêng `api/decisionsClient.ts` | Tách biệt | Inconsistent với codebase hiện tại |

→ **Chọn A**: append vào `api/client.ts`.

---

## 2. Impact Analysis

### 2.1 Existing code cần đọc trước implementation

| File | Lý do cần đọc |
|------|--------------|
| `backend/src/index.ts` | Biết cách đăng ký router mới |
| `backend/src/paybacktime/GetTradeInfo.ts` | Pattern axios + Vietstock auth → tái sử dụng cho `historicalquote` |
| `backend/src/db/connection.ts` | Import `pool` |
| `backend/src/routes/valuation.ts` | Pattern Router + error handling |
| `frontend/src/App.tsx` | Thêm tab vào `activeTab` union + render block |
| `frontend/src/api/client.ts` | Append decision functions theo cùng pattern |
| `frontend/src/locales/vi.json` | Biết flat structure, thêm `decisions.*` keys |
| `frontend/src/locales/en.json` | Tương tự |
| `frontend/src/locales/ja.json` | Tương tự |
| `backend/package.json` | Thêm `@anthropic-ai/sdk` dependency |

### 2.2 Files bị ảnh hưởng (đầy đủ)

#### Files MODIFIED (existing)
| File | Thay đổi |
|------|---------|
| `backend/src/index.ts` | Import + `app.use("/api/decisions", decisionsRouter)` |
| `backend/package.json` | Thêm `"@anthropic-ai/sdk": "^0.x"` vào dependencies |
| `frontend/src/App.tsx` | Thêm `"decisions"` vào `activeTab` union; thêm tab button + render block |
| `frontend/src/api/client.ts` | Thêm types + functions cho decisions API |
| `frontend/src/locales/vi.json` | Thêm `decisions.*` keys |
| `frontend/src/locales/en.json` | Thêm `decisions.*` keys |
| `frontend/src/locales/ja.json` | Thêm `decisions.*` keys |
| `.env.example` | Thêm `ANTHROPIC_API_KEY=` |

#### Files/Dirs NEW
| File | Mô tả |
|------|-------|
| `database/migrations/001_decision_tables.sql` | DDL cho 3 bảng mới |
| `backend/src/routes/decisions.ts` | Tất cả /api/decisions endpoints |
| `backend/src/lib/priceService.ts` | Vietstock tradinginfo + historicalquote fetch |
| `backend/src/lib/aiService.ts` | Claude review + pattern generation |
| `backend/src/lib/decisionValidation.ts` | Validate entry fields (stop_loss required for BUY, exit_pct sum, reason length, v.v.) |
| `frontend/src/components/decisions/DecisionsTab.tsx` | Container: quản lý view state (timeline / form / detail) |
| `frontend/src/components/decisions/DecisionTimeline.tsx` | View 1: danh sách + filter |
| `frontend/src/components/decisions/DecisionForm.tsx` | View 2: form thêm/sửa |
| `frontend/src/components/decisions/DecisionDetail.tsx` | View 3: chi tiết + reviews + user_note |
| `frontend/src/components/decisions/DecisionSummary.tsx` | Feature C: tỉ lệ + pattern |

#### DB tables NEW (trong `finance` database)
| Table | Mô tả |
|-------|-------|
| `decision_journal` | Entry chính — xem spec §5.5 |
| `decision_review` | Review do AI sinh — xem spec §5.5 |
| `decision_pattern_cache` | Cache kết quả pattern analysis |

#### Permissions / Env vars
| Var | Nguồn | Mục đích |
|-----|-------|---------|
| `ANTHROPIC_API_KEY` | `.env` (mới) | Claude API auth |
| `VIETSTOCK_COOKIE` | `.env` (đã có) | Vietstock auth |
| `VIETSTOCK_TOKEN` | `.env` (đã có) | Vietstock CSRF token |

#### Logging (backend)
- AI request log: `decision_id`, `model_id`, latency (ms), token_count (input/output), success/failure — **không log raw prompt hoặc response**.
- Mutation log: `decision_id`, action (CREATE/UPDATE/DELETE), `updated_at` — không log nội dung `reason`/`user_note`.
- Error log: khi AI fail 2 lần → log `prompt_hash`, `model_id`, status code.

---

## 3. DB Changes

### Migration: `database/migrations/001_decision_tables.sql`

```sql
-- Table 1: decision_journal
CREATE TABLE IF NOT EXISTS `decision_journal` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `ticker`        VARCHAR(10)  NOT NULL,
  `decision_type` ENUM('BUY','SELL','HOLD','WATCH') NOT NULL,
  `decided_at`    DATETIME     NOT NULL,
  `entry_price`   DOUBLE       NULL,
  `volume`        DOUBLE       NULL COMMENT '% of portfolio, e.g. 10.5 = 10.5%',
  `risk_plan`     JSON         NULL,
  `reason`        TEXT         NOT NULL,
  `confidence`    TINYINT      NULL COMMENT '1-5',
  `mood`          ENUM('CALM','EXCITED','FEARFUL','FOMO','NEUTRAL') NULL,
  `sources`       TEXT         NULL,
  `user_note`     TEXT         NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME     NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ticker_decided_at` (`ticker`, `decided_at`),
  INDEX `idx_decision_type`     (`decision_type`),
  INDEX `idx_deleted_at`        (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: decision_review
CREATE TABLE IF NOT EXISTS `decision_review` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `decision_id`    BIGINT        NOT NULL,
  `reviewed_at`    DATETIME      NOT NULL,
  `verdict`        ENUM('CORRECT','WRONG','UNCLEAR') NOT NULL,
  `verdict_reason` TEXT          NOT NULL,
  `strengths`      JSON          NOT NULL,
  `weaknesses`     JSON          NOT NULL,
  `lessons`        JSON          NOT NULL,
  `price_snapshot` JSON          NOT NULL,
  `model_id`       VARCHAR(64)   NOT NULL,
  `prompt_hash`    CHAR(64)      NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_decision_reviewed` (`decision_id`, `reviewed_at`),
  CONSTRAINT `fk_review_decision`
    FOREIGN KEY (`decision_id`) REFERENCES `decision_journal`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: decision_pattern_cache
CREATE TABLE IF NOT EXISTS `decision_pattern_cache` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT,
  `computed_at` DATETIME NOT NULL,
  `result`      JSON     NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Rollback**: `DROP TABLE IF EXISTS decision_pattern_cache, decision_review, decision_journal;` (theo thứ tự này do FK).

---

## 4. Implementation Steps

> Nguyên tắc: 1 step = 1 đơn vị có thể review độc lập. Mỗi step hoàn thành → commit riêng.

### Step 1 — DB Migration
- Viết `database/migrations/001_decision_tables.sql` (nội dung §3 ở trên).
- Chạy trên DB dev.
- Verify: `SHOW TABLES LIKE 'decision%';` trả về 3 bảng; `DESCRIBE decision_journal;` khớp spec.
- **Không** thay đổi file backend/frontend nào.

### Step 2 — Install Anthropic SDK
- `cd backend && npm install @anthropic-ai/sdk`
- Verify: `backend/package.json` có entry `@anthropic-ai/sdk`; `npm list @anthropic-ai/sdk` thành công.
- Thêm `ANTHROPIC_API_KEY=` vào `.env.example`.
- **Không** viết code dùng SDK trong step này.

### Step 3 — `priceService.ts` (Vietstock price fetch)
- Tạo `backend/src/lib/priceService.ts`.
- Export 2 functions:
  - `getCurrentPrice(ticker: string): Promise<number>` — tái sử dụng pattern `GetTradeInfo` với `tradinginfo` endpoint.
  - `getHistoricalPrices(ticker: string, startDate: string, endDate: string): Promise<DailyPrice[]>` — dùng `historicalquote` endpoint, cùng auth pattern.
- Export type `DailyPrice { date: string; close: number }`.
- Export function `buildPriceSnapshot(entry, history, currentPrice)` → `PriceSnapshot` object (dùng trong review).
- Timeout: 10s (giống GetTradeInfo).
- Nếu fetch thất bại → throw `PriceFetchError` (custom error class) để route handler bắt và trả 503.
- **Lưu ý**: Cần xác nhận exact params của `historicalquote` (xem Pre-impl Checklist mục C1).

### Step 4 — `decisionValidation.ts`
- Tạo `backend/src/lib/decisionValidation.ts`.
- Export `validateEntry(body): ValidationError[]` — kiểm tra:
  - `reason` length ≥ 20 và ≤ 5000.
  - `entry_price` bắt buộc nếu `decision_type` là BUY hoặc SELL.
  - `risk_plan.stop_loss` bắt buộc nếu BUY.
  - Tổng `risk_plan.take_profits[].exit_pct` ≤ 100.
  - `confidence` ∈ [1, 5] nếu có.
  - `volume` ≥ 0 nếu có.
  - `ticker` không rỗng.
- Trả array `{ field, code }` — rỗng nếu valid.
- Pure function, không gọi DB.
- **Không** tạo route trong step này.

### Step 5 — `aiService.ts`
- Tạo `backend/src/lib/aiService.ts`.
- Import `Anthropic` từ `@anthropic-ai/sdk`.
- Export `reviewDecision(entry, priceSnapshot, lang: "vi"|"en"|"ja"): Promise<AIReviewOutput>`.
  - Build prompt từ entry + price snapshot.
  - Gọi `claude-sonnet-4-6`.
  - Parse JSON response, validate schema (`verdict`, `verdict_reason`, `strengths`, `weaknesses`, `lessons`).
  - Nếu schema invalid → retry 1 lần với prompt nhấn mạnh JSON format.
  - Thất bại lần 2 → throw `AIInvalidResponseError` (custom error).
  - Log: `decision_id` (truyền vào), model_id, latency, token counts — không log raw prompt/response.
  - Compute `prompt_hash` (sha256 của raw prompt string) — lưu kèm review.
- Export `analyzePatterns(lessonsAndWeaknesses: string[], lang: "vi"|"en"|"ja"): Promise<PatternResult>`.
  - Gọi AI một lần; AI tự quyết threshold (prompt không hardcode N).
  - Yêu cầu AI trả JSON: `{ mistakes: [{description, count}], successes: [{description, count}] }`.
- Timeout 60s (NFR-1).

### Step 6 — `routes/decisions.ts` — CRUD endpoints
- Tạo `backend/src/routes/decisions.ts`, export `decisionsRouter`.
- Implement:
  - `GET /` — list entries (query: ticker, type, from, to, limit, offset); filter `deleted_at IS NULL`.
  - `GET /:id` — chi tiết 1 entry + tất cả review (eager load `decision_review` ORDER BY reviewed_at DESC).
  - `POST /` — validate → insert → trả 201 + `{ data: entry }`.
  - `PUT /:id` — validate → update → trả 200 + `{ data: entry }`.
  - `DELETE /:id` — soft-delete: `SET deleted_at = NOW()` → trả 200 `{ data: { id } }`.
  - `PUT /:id/note` — update `user_note` field → trả 200 `{ data: { id, userNote } }`.
- Dùng `validateEntry()` từ step 4.
- **Chưa** implement review endpoints trong step này.

### Step 7 — Register `decisionsRouter` trong `index.ts`
- Thêm import + `app.use("/api/decisions", decisionsRouter)` vào `backend/src/index.ts`.
- Verify: `GET /api/decisions` trả `{ data: [] }` với DB rỗng.

### Step 8 — Review endpoints
- Trong `routes/decisions.ts`, thêm:
  - `POST /:id/reviews` — trigger AI review:
    1. Load entry từ DB; kiểm tra `deleted_at IS NULL`.
    2. Kiểm tra `now - decided_at >= 24h`; nếu không → 400 `{ error: "too_soon" }`.
    3. Gọi `priceService.getCurrentPrice` + `priceService.getHistoricalPrices` → nếu thất bại → 503 `{ error: "price_fetch_failed" }`.
    4. Build `priceSnapshot`.
    5. Gọi `aiService.reviewDecision` → nếu thất bại → 502 `{ error: "ai_invalid_response" }`.
    6. Insert row vào `decision_review`.
    7. Trả 200 `{ data: review }`.
  - `GET /:id/reviews` — list reviews của 1 entry ORDER BY reviewed_at DESC.

### Step 9 — Summary endpoints
- Trong `routes/decisions.ts`, thêm:
  - `GET /summary` — trả `{ data: { correct, wrong, unclear, total, patternCache: <latest row or null> } }`:
    - Tính từ review mới nhất mỗi entry (subquery / GROUP BY decision_id ORDER BY reviewed_at DESC LIMIT 1).
    - Nếu total review < 5 → `patterns: []`.
    - Kèm `patternCache` = row mới nhất từ `decision_pattern_cache` (hoặc null).
  - `POST /summary/pattern` — trigger pattern AI:
    1. Fetch tất cả `lessons` + `weaknesses` từ reviews (không bị deleted_at).
    2. Nếu count < 5 → 400 `{ error: "insufficient_data" }`.
    3. Gọi `aiService.analyzePatterns`.
    4. Insert vào `decision_pattern_cache`.
    5. Trả 200 `{ data: result + computed_at }`.
- **Lưu ý routing order**: `GET /summary` phải được đăng ký TRƯỚC `GET /:id` để tránh Express match "summary" như một `:id`. Đặt `/summary` routes ở đầu file.

### Step 10 — i18n keys
- Thêm `decisions.*` keys vào cả 3 locale files.
- Keys tối thiểu (đầy đủ khi viết component):

```json
{
  "decisions": {
    "tab_title": "Quyết Định",
    "summary_tab_title": "Tổng Kết",
    "btn_add": "+ Thêm quyết định",
    "btn_evaluate": "Đánh giá",
    "btn_patterns": "Tính pattern",
    "btn_edit": "Sửa",
    "btn_delete": "Xoá",
    "btn_save": "Lưu",
    "btn_cancel": "Huỷ",
    "empty_state": "Chưa có quyết định nào — bấm '+ Thêm' để bắt đầu",
    "loading": "Đang tải…",
    "evaluate_too_soon": "Cần đợi ít nhất 24h sau khi ra quyết định",
    "evaluate_timeout": "Đánh giá quá lâu — vui lòng thử lại",
    "evaluate_price_fail": "Không lấy được giá — vui lòng thử lại",
    "evaluate_ai_fail": "AI không thể đánh giá — vui lòng thử lại",
    "note_placeholder": "Ghi chú cá nhân của bạn...",
    "no_pattern": "Chưa có pattern — bấm 'Tính pattern' để phân tích",
    "insufficient_data": "Cần ít nhất 5 đánh giá để phát hiện pattern",
    "pattern_computed_at": "Tính lúc: {{datetime}}",
    "verdict.correct": "Đúng",
    "verdict.wrong": "Sai",
    "verdict.unclear": "Chưa rõ",
    "type.buy": "Mua",
    "type.sell": "Bán",
    "type.hold": "Giữ",
    "type.watch": "Quan sát",
    "mood.calm": "Bình tĩnh",
    "mood.excited": "Hứng khởi",
    "mood.fearful": "Lo sợ",
    "mood.fomo": "FOMO",
    "mood.neutral": "Trung tính",
    "form.ticker": "Mã chứng khoán",
    "form.decision_type": "Loại quyết định",
    "form.decided_at": "Thời điểm quyết định",
    "form.entry_price": "Giá vào lệnh (VND)",
    "form.volume": "Tỉ trọng danh mục (%)",
    "form.reason": "Lý do quyết định",
    "form.confidence": "Mức độ tự tin",
    "form.mood": "Tâm trạng",
    "form.sources": "Nguồn tham khảo",
    "form.stop_loss": "Stop-loss",
    "form.take_profit": "Take-profit",
    "form.dca": "DCA",
    "form.trailing_stop": "Trailing stop",
    "form.max_portfolio_pct": "Tỉ trọng tối đa (%)",
    "error.reason_too_short": "Lý do phải có ít nhất 20 ký tự",
    "error.stop_loss_required": "Bắt buộc có stop-loss khi BUY",
    "error.exit_pct_exceeds": "Tổng tỉ lệ chốt lời vượt 100%",
    "badge.reviewed": "Đã đánh giá",
    "badge.not_reviewed": "Chưa đánh giá",
    "col.date": "Ngày",
    "col.ticker": "Mã CK",
    "col.type": "Loại",
    "col.price": "Giá vào",
    "col.volume": "Tỉ trọng",
    "col.reason_preview": "Lý do",
    "col.status": "Trạng thái",
    "confirm_delete": "Bạn có chắc muốn xoá quyết định này không?",
    "delete_success": "Đã xoá quyết định.",
    "save_success": "Đã lưu.",
    "summary.title": "Tổng kết quyết định",
    "summary.correct": "Đúng",
    "summary.wrong": "Sai",
    "summary.unclear": "Chưa rõ",
    "summary.total": "Tổng",
    "summary.mistake_patterns": "Pattern sai lầm lặp lại",
    "summary.success_patterns": "Pattern thành công",
    "review.verdict_reason": "Nhận định",
    "review.strengths": "Điểm hợp lý",
    "review.weaknesses": "Điểm yếu",
    "review.lessons": "Bài học",
    "review.price_at_review": "Giá lúc đánh giá",
    "review.change_pct": "Thay đổi so với giá vào"
  }
}
```

### Step 11 — Thêm "Decisions" tab vào `App.tsx`
- Thêm `"decisions"` vào `activeTab` union type: `"ranking" | "valuation" | "screening" | "decisions"`.
- Thêm tab button với label `📓  {t("decisions.tab_title")}`.
- Thêm render block: `{activeTab === "decisions" && <DecisionsTab />}`.
- Import `DecisionsTab` từ `./components/decisions/DecisionsTab`.
- **Không** thay đổi logic tab khác.

### Step 12 — `DecisionTimeline.tsx` (View 1)
- Props: `onAdd: () => void`, `onSelect: (id: number) => void`.
- State: filter state (ticker, type[], from, to), danh sách entries.
- Fetch `GET /api/decisions` với filter params; hiển thị loading + error state.
- Mỗi hàng: `decided_at`, `ticker`, `type`, `entry_price` (formatted VND), `volume`, trích đoạn reason (120 ký tự), badge "Đã đánh giá" / "Chưa đánh giá".
- Empty state: `t("decisions.empty_state")`.
- Nút "+ Thêm quyết định" → gọi `onAdd()`.

### Step 13 — `DecisionForm.tsx` (View 2)
- Props: `entry?: DecisionEntry` (undefined = tạo mới), `onSave: (entry) => void`, `onCancel: () => void`.
- Client-side validation trước submit (dùng cùng rules như `decisionValidation.ts`).
- `risk_plan` section: hiển thị/ẩn dựa theo `decision_type`.
  - stop_loss: hiển thị khi BUY.
  - take_profits: dynamic list (add/remove row); hiển thị cảnh báo nếu tổng exit_pct > 100.
  - dca_levels: dynamic list.
  - trailing_stop: optional, toggle.
  - max_portfolio_pct: hiển thị khi BUY.
- Submit → POST hoặc PUT → nếu lỗi server → hiển thị message, **không** clear form.
- Sau khi tạo thành công → gọi `onSave(entry)`.
- `entry_price` input: hiển thị với dấu phân cách nghìn (1,000,000 VND).

### Step 14 — `DecisionDetail.tsx` (View 3)
- Props: `id: number`, `onEdit: () => void`, `onBack: () => void`.
- Fetch `GET /api/decisions/:id` (eager load reviews).
- Render `risk_plan` thành bảng (không show raw JSON).
- Nút "Đánh giá":
  - Disabled nếu `now - decided_at < 24h` (AC-10, client-side check).
  - Click → POST `/api/decisions/:id/reviews?lang=<currentLang>`.
  - Hiển thị spinner; timeout 60s → hiển thị `t("decisions.evaluate_timeout")`.
  - Nếu 503 → `t("decisions.evaluate_price_fail")`.
  - Nếu 502 → `t("decisions.evaluate_ai_fail")`.
- Danh sách reviews: ORDER BY `reviewed_at DESC`; mỗi review render 4 section: Kết luận / Điểm hợp lý / Điểm yếu / Bài học.
- `user_note` khu vực: `<textarea>` edit inline; auto-save khi blur → PUT `/api/decisions/:id/note`.
- Nút "Xoá" → confirm dialog → DELETE → navigate back (AC-7).

### Step 15 — `DecisionSummary.tsx` (Feature C)
- Fetch `GET /api/decisions/summary` khi mount.
- Hiển thị pie chart hoặc stacked bar (dùng Recharts) với CORRECT / WRONG / UNCLEAR.
- Filter theo khoảng thời gian (from/to theo `decided_at`).
- Pattern panel:
  - Nếu `patternCache` null → "Chưa có pattern — bấm 'Tính pattern' để phân tích".
  - Nếu có cache → hiển thị danh sách `mistakes` + `successes` + `t("decisions.pattern_computed_at", { datetime })`.
  - Nếu total reviews < 5 → "Cần ít nhất 5 đánh giá để phát hiện pattern".
  - Nút "Tính pattern" → POST `/api/decisions/summary/pattern` → cập nhật UI.

### Step 16 — `DecisionsTab.tsx` (container)
- State: `view: "timeline" | "form" | "detail"`, `selectedId: number | null`, `editEntry: DecisionEntry | null`.
- Route giữa 3 views dựa theo state.
- Summary view: có thể là sub-tab bên trong DecisionsTab hoặc panel dưới timeline — implement theo style hiện tại (2 buttons: "Danh sách" / "Tổng kết").

### Step 17 — Add decision API functions to `api/client.ts`
- Append types: `DecisionEntry`, `DecisionReview`, `DecisionSummaryResponse`, `PatternResult`.
- Append functions: `fetchDecisions`, `fetchDecision`, `createDecision`, `updateDecision`, `deleteDecision`, `updateDecisionNote`, `createReview`, `fetchReviews`, `fetchDecisionSummary`, `triggerPatternAnalysis`.
- Pattern giống các function hiện có: native `fetch`, throw `Error` nếu `!res.ok`.

---

## 5. New Dependencies

| Package | Scope | Version | Lý do |
|---------|-------|---------|-------|
| `@anthropic-ai/sdk` | backend runtime | latest | Claude API client |

Frontend: không có dependency mới (Recharts đã có, i18next đã có).

---

## 6. Environment Variables

Thêm vào `.env` (không commit):
```
ANTHROPIC_API_KEY=<your-key>
```

`.env.example` (commit):
```
ANTHROPIC_API_KEY=
```

Biến đã có sẵn và cần giữ nguyên:
```
VIETSTOCK_COOKIE=
VIETSTOCK_TOKEN=
```

---

## 7. Risks & Mitigations

| ID | Risk | Xác suất | Ảnh hưởng | Mitigation |
|----|------|---------|-----------|-----------|
| R-3 | `historicalquote` endpoint Vietstock thay đổi params → priceService fail | Trung bình | Cao | Abstract `PriceFetcher` interface → dễ swap; log raw error khi 4xx/5xx |
| R-4 | `ANTHROPIC_API_KEY` lộ trong FE bundle | Thấp | Cao | AC-22: grep build output trước deploy; mọi AI call đi qua BE |
| R-1 | AI cost vượt $10/tháng | Thấp (single-user) | Thấp | Monitor token log; không cần cap tự động |
| R-6 | `risk_plan` JSON column khó migrate nếu cần normalize | Trung bình | Trung bình | Migration script sẵn sàng khi cần; không ảnh hưởng Phase 1 |
| R-7 | i18n key drift | Thấp | Thấp | AC-23: so sánh keys 3 file trước merge |
| **RN-1** | Route conflict `GET /summary` vs `GET /:id` | Cao nếu không chú ý | Trung bình | Đăng ký `/summary` TRƯỚC `/:id` trong Router (Step 9) |
| **RN-2** | Vietstock cookie hết hạn | Trung bình | Cao | AI review trả 503 `price_fetch_failed`; hướng dẫn refresh cookie trong README |

---

## 8. Rollback Procedure

### Backend rollback
1. Revert `backend/src/index.ts` — xoá import + `app.use` cho `decisionsRouter`.
2. Xoá `backend/src/routes/decisions.ts`, `backend/src/lib/priceService.ts`, `backend/src/lib/aiService.ts`, `backend/src/lib/decisionValidation.ts`.
3. `npm uninstall @anthropic-ai/sdk`.

### DB rollback
```sql
DROP TABLE IF EXISTS decision_pattern_cache;
DROP TABLE IF EXISTS decision_review;
DROP TABLE IF EXISTS decision_journal;
```
(Thứ tự quan trọng: xoá bảng có FK trước.)

### Frontend rollback
1. Revert `App.tsx` — xoá `"decisions"` khỏi union, tab button, render block.
2. Xoá `frontend/src/components/decisions/` directory.
3. Revert locale files — xoá `decisions.*` keys.
4. Revert `api/client.ts` — xoá decision functions.

---

## 9. Verification Procedure

### Sau mỗi step
- Build backend: `cd backend && npm run build` (tsc strict, no error).
- Build frontend: `cd frontend && npm run build` (tsc strict, no error).
- Chạy dev: `npm run dev` cả 2 service.

### Functional verification (mỗi AC)
Xem AC mapping table ở §10. Chạy theo thứ tự:

1. **DB**: `SHOW TABLES; DESCRIBE decision_journal;` — verify columns khớp spec.
2. **CRUD API smoke test** (curl/Postman):
   - POST `/api/decisions` với BUY entry đầy đủ → 201.
   - POST thiếu reason → 400.
   - POST BUY thiếu stop_loss → 400 `stop_loss_required_for_buy`.
   - GET `/api/decisions` → trả entry vừa tạo.
   - PUT, DELETE (soft) → verify `deleted_at` set; entry biến mất khỏi list.
3. **Filter**: GET với `ticker=VCB&type=BUY` → chỉ trả VCB BUY entries.
4. **Review API** (cần Vietstock cookie còn hạn + ANTHROPIC_API_KEY):
   - POST `/api/decisions/:id/reviews` với entry > 24h → trả review với verdict.
   - Kiểm tra `decision_review` có row mới với `model_id=claude-sonnet-4-6`.
5. **Summary**: GET `/api/decisions/summary` → trả correct/wrong/unclear counts.
6. **Pattern**: POST `/api/decisions/summary/pattern` với ≥ 5 reviews → trả pattern.
7. **UI smoke test**:
   - Tab "Quyết Định" hiển thị, không break các tab khác.
   - Empty state → thêm entry → xuất hiện trong timeline.
   - Form validation inline error (thiếu reason, stop_loss, exit_pct > 100).
   - Chi tiết entry: render risk_plan thành bảng (không show JSON).
   - Nút "Đánh giá" disabled < 24h.
8. **i18n**: đổi sang EN → tất cả label trong tab Decisions chuyển sang English; sang JA → Japanese.
9. **Security check**: `grep -r "ANTHROPIC_API_KEY" frontend/dist/` → không có kết quả.

---

## 10. Pre-Implementation Checklist

Xác nhận những mục này TRƯỚC khi bắt đầu code:

### Môi trường
- [ ] **C1** — Xác nhận exact params của Vietstock `historicalquote` endpoint: `code=`, `startDate=`, `endDate=` (format dd/MM/yyyy hay yyyy-MM-dd?). Cách xác nhận: mở DevTools Vietstock, xem request params thực tế.
- [ ] **C2** — `VIETSTOCK_COOKIE` và `VIETSTOCK_TOKEN` hiện tại còn hạn? Test bằng cách chạy `GetTradeInfo("VCB")` từ terminal.
- [ ] **C3** — `ANTHROPIC_API_KEY` có sẵn và đã được set trong `.env`?
- [ ] **C4** — DB user có quyền `CREATE TABLE` trên schema `finance`? Test: `GRANT SHOW` hoặc thử tạo bảng test.

### Design
- [ ] **C5** — Xác nhận UI style cho `risk_plan` render: bảng 3 cột (loại / giá trị / mode) hay format khác? (spec nói "bảng dễ đọc" nhưng không chi tiết layout).
- [ ] **C6** — Xác nhận Summary view layout: sub-tab riêng "Tổng kết" bên trong DecisionsTab, hay panel luôn hiển thị dưới timeline? (spec không chốt rõ — OI tiềm năng nếu cần design khác nhau).

### Thông tin thiếu / cần chốt
- [ ] **C7** — AC-13 trong spec có typo: "dữ liệu giá được fetch từ VNDirect API" nhưng OI-1 CLOSED chốt Vietstock. Xác nhận: dùng Vietstock (đã có auth) hay VNDirect (public, không cần auth)? → **Giả định: Vietstock** theo OI-1.
- [ ] **C8** — `historicalquote` có trả VNINDEX không (ticker = "VNINDEX")? Verify trước khi viết code.

---

## 11. AC Mapping Table

| AC | Được đáp ứng ở | Layer | Step |
|----|---------------|-------|------|
| **AC-1** | `DecisionTimeline.tsx` empty state | FE | Step 12 |
| **AC-2** | `POST /api/decisions` → 201 + insert; timeline re-fetch | BE + FE | Step 6, 13 |
| **AC-3** | `validateEntry()` → 400; FE hiển thị inline error, không clear form | BE + FE | Step 4, 6, 13 |
| **AC-4** | `validateEntry()` kiểm tra stop_loss required for BUY → 400 `stop_loss_required_for_buy` | BE | Step 4, 6 |
| **AC-5** | `GET /api/decisions?ticker=&type=` WHERE clause | BE | Step 6 |
| **AC-6** | `GET /api/decisions?from=&to=` WHERE `decided_at BETWEEN` | BE | Step 6 |
| **AC-7** | `DELETE /api/decisions/:id` soft-delete; `deleted_at` set; list filter | BE + FE | Step 6, 14 |
| **AC-8** | `PUT /api/decisions/:id` update `updated_at`; reviews preserved (FK ON DELETE CASCADE chỉ khi DELETE) | BE | Step 6 |
| **AC-9** | `validateEntry()` tổng exit_pct ≤ 100 → 400 `take_profit_exit_pct_exceeds_100` | BE | Step 4, 6 |
| **AC-10** | `DecisionDetail.tsx` disable button if `now - decided_at < 24h` | FE | Step 14 |
| **AC-11** | `POST /api/decisions/:id/reviews` → AI call → insert review | BE | Step 8 |
| **AC-12** | `aiService.ts` retry 1 lần; fail → throw; route trả 502; không insert; log prompt_hash | BE | Step 5, 8 |
| **AC-13** | `priceService.ts` fetch Vietstock; `price_snapshot` lưu kèm review | BE | Step 3, 8 |
| **AC-14** | `GET /api/decisions/:id` eager load reviews ORDER BY reviewed_at DESC; FE render | BE + FE | Step 6, 14 |
| **AC-15** | `PUT /api/decisions/:id/note` update `user_note`; FE auto-save on blur | BE + FE | Step 6, 14 |
| **AC-16** | `POST /api/decisions/:id/reviews?lang=vi|en|ja`; prompt template có lang param | BE | Step 5, 8 |
| **AC-17** | N/A (removed) | — | — |
| **AC-18** | `GET /api/decisions/summary` GROUP BY decision_id HAVING MAX reviewed_at | BE | Step 9 |
| **AC-19** | Summary endpoint: nếu total reviews < 5 → `patterns: []`; FE hiển thị message | BE + FE | Step 9, 15 |
| **AC-20** | `POST /api/decisions/summary/pattern` → AI → insert cache → return; `GET /summary` trả cache; FE render | BE + FE | Step 9, 15 |
| **AC-21** | Index `(ticker, decided_at)` + `(deleted_at)` trên `decision_journal`; pagination với limit/offset | BE + DB | Step 1, 6 |
| **AC-22** | `ANTHROPIC_API_KEY` chỉ đọc ở BE; không có trong FE bundle | BE policy | Step 2, 5 |
| **AC-23** | 3 locale files có đầy đủ `decisions.*` keys | FE | Step 10 |
| **AC-24** | `aiService.ts` timeout 60s; FE xử lý timeout error → hiển thị message; không insert review | BE + FE | Step 5, 8, 14 |
