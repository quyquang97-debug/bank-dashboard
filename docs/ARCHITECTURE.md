# Kiến Trúc Dự Án Bank Dashboard

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Frontend Architecture](#3-frontend-architecture)
   - [App.tsx — Tab Routing](#31-apptsx--tab-routing)
   - [API Layer](#32-api-layer)
   - [Tab: Xếp hạng (Ranking)](#33-tab-xếp-hạng-ranking)
   - [Tab: Định giá (Valuation)](#34-tab-định-giá-valuation)
   - [Tab: Sàng lọc (Screening)](#35-tab-sàng-lọc-screening)
   - [Tab: Quyết định (Decisions)](#36-tab-quyết-định-decisions)
   - [Tab: Tổng kết (Summary)](#37-tab-tổng-kết-summary)
   - [Internationalization](#38-internationalization)
4. [Backend Architecture](#4-backend-architecture)
   - [Express Server](#41-express-server)
   - [Database Layer](#42-database-layer)
   - [Schema Database](#43-schema-database)
   - [Route: Sàng lọc — /api/screening](#44-route-sàng-lọc--apiscreening)
   - [Route: Quyết định — /api/decisions](#45-route-quyết-định--apidecisions)
   - [Các Service quan trọng](#46-các-service-quan-trọng)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
   - [Sàng lọc](#51-sàng-lọc)
   - [Quyết định — Thêm & Đánh giá](#52-quyết-định--thêm--đánh-giá)
   - [Tổng kết — Phân tích pattern](#53-tổng-kết--phân-tích-pattern)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Quy ước đặt tên & Pattern quan trọng](#7-quy-ước-đặt-tên--pattern-quan-trọng)

---

## 1. Tổng quan

**Bank Dashboard** là ứng dụng phân tích đầu tư ngân hàng gồm 3 lớp:

| Lớp | Công nghệ | Port |
|-----|-----------|------|
| Frontend | React 19 + TypeScript + Vite | 5173 |
| Backend | Express.js + TypeScript | 3001 |
| Database | MySQL 8.0+ | 3306 |

**5 chức năng chính** (tương ứng 5 tab):

| Tab | Tiếng Việt | Mô tả ngắn |
|-----|------------|------------|
| `ranking` | Xếp hạng | Xếp hạng ngân hàng theo chỉ số tài chính |
| `valuation` | Định giá | Tính MOS và tỉ suất sinh lợi |
| `screening` | Sàng lọc | Tín hiệu MUA/GIỮ/TRÁNH kết hợp rank + valuation |
| `decisions` | Quyết định | Nhật ký quyết định đầu tư + đánh giá AI |
| `summary` | Tổng kết | Thống kê verdict + phân tích pattern sai/đúng |

---

## 2. Cấu trúc thư mục

```
bank-dashboard/
├── frontend/
│   └── src/
│       ├── App.tsx                         # Layout chính + tab routing
│       ├── main.tsx                        # Entry point
│       ├── api/
│       │   └── client.ts                   # Tất cả API calls (typed)
│       ├── components/
│       │   ├── BankList.tsx                # Bảng ngân hàng (Ranking)
│       │   ├── TrendChart.tsx              # Biểu đồ lịch sử metrics
│       │   ├── RankingChart.tsx            # Biểu đồ điểm tích lũy
│       │   ├── PeriodFilter.tsx            # Dropdown chọn kỳ báo cáo
│       │   ├── ScreeningTab.tsx            # Tab Sàng lọc
│       │   ├── ValuationTab.tsx            # Tab Định giá
│       │   ├── LangSwitcher.tsx            # Chuyển ngôn ngữ
│       │   └── decisions/
│       │       ├── DecisionsTab.tsx        # Router: timeline/form/detail
│       │       ├── DecisionTimeline.tsx    # Danh sách + bộ lọc
│       │       ├── DecisionForm.tsx        # Form thêm/sửa
│       │       ├── DecisionDetail.tsx      # Xem chi tiết + reviews
│       │       └── DecisionSummary.tsx     # Thống kê + patterns
│       ├── i18n.ts                         # Cấu hình i18next
│       └── locales/
│           ├── vi.json
│           ├── en.json
│           └── ja.json
│
├── backend/
│   └── src/
│       ├── index.ts                        # Express server entry
│       ├── db/
│       │   ├── connection.ts              # MySQL connection pool
│       │   └── queries.ts                 # Period parsing + detection
│       ├── config/
│       │   └── screeningConfig.ts         # Ngưỡng & trọng số Sàng lọc
│       ├── lib/
│       │   ├── aiService.ts              # Claude AI (review + patterns)
│       │   ├── priceService.ts           # Vietstock price fetching
│       │   ├── decisionValidation.ts     # Validation quyết định
│       │   ├── detectWindow.ts           # Xác định kỳ hiện tại
│       │   └── saveMos.ts               # Lưu MOS vào DB
│       ├── paybacktime/
│       │   ├── CalMos.ts                # Công thức MOS
│       │   ├── GetTradeInfo.ts          # Giá hiện tại
│       │   ├── GetReportDataDetailValue.ts # Lấy dữ liệu tài chính
│       │   └── GetIdList.ts             # Map mã CP → ID
│       └── routes/
│           ├── banks.ts                 # /api/banks
│           ├── ranking.ts               # /api/ranking
│           ├── periods.ts               # /api/periods
│           ├── screening.ts             # /api/screening
│           ├── valuation.ts             # /api/valuation
│           └── decisions.ts             # /api/decisions
│
└── database/                             # Schema & migrations
```

---

## 3. Frontend Architecture

### 3.1 App.tsx — Tab Routing

`App.tsx` là root component, quản lý toàn bộ state cấp ứng dụng:

```typescript
// State chính
const [activeTab, setActiveTab]         // Tab đang hiển thị
const [selectedBank, setSelectedBank]   // Ngân hàng đang chọn (Ranking)
const [selectedPeriod, setSelectedPeriod] // Kỳ báo cáo đang chọn
const [periods, setPeriods]             // Danh sách kỳ có dữ liệu
```

**Lifecycle:** Khi mount → fetch `periods` + `banks` cho kỳ mặc định.

**Tab render:** Switch theo `activeTab` → render component tương ứng.

> **Lưu ý khi thêm tab mới:** Thêm `activeTab` vào switch trong `App.tsx`, đăng ký route API trong `backend/src/index.ts`, và thêm translation key vào 3 file locales.

---

### 3.2 API Layer

**File:** [frontend/src/api/client.ts](../frontend/src/api/client.ts)

Tất cả API calls đều đi qua file này. Base URL lấy từ `VITE_API_BASE_URL`.

| Hàm | Method | Endpoint | Dùng ở tab |
|-----|--------|----------|------------|
| `fetchBanks(period?)` | GET | `/api/banks` | Ranking |
| `fetchTrend(code, period?)` | GET | `/api/banks/:code/trend` | Ranking |
| `fetchRanking(period?)` | GET | `/api/ranking` | Ranking |
| `fetchRankingHistory()` | GET | `/api/ranking/history` | Ranking |
| `fetchPeriods()` | GET | `/api/periods` | App.tsx |
| `fetchValuation()` | GET | `/api/valuation` | Định giá |
| `runValuation()` | POST | `/api/valuation/run` | Định giá |
| `fetchScreening(year, quarter)` | GET | `/api/screening` | Sàng lọc |
| `fetchDecisions(filters)` | GET | `/api/decisions` | Quyết định |
| `fetchDecision(id)` | GET | `/api/decisions/:id` | Quyết định |
| `createDecision(data)` | POST | `/api/decisions` | Quyết định |
| `updateDecision(id, data)` | PUT | `/api/decisions/:id` | Quyết định |
| `deleteDecision(id)` | DELETE | `/api/decisions/:id` | Quyết định |
| `fetchCurrentPrice(id)` | GET | `/api/decisions/:id/current-price` | Quyết định |
| `createReview(id, data, lang)` | POST | `/api/decisions/:id/reviews` | Quyết định |
| `updateNote(id, note)` | PUT | `/api/decisions/:id/note` | Quyết định |
| `fetchDecisionSummary(filters)` | GET | `/api/decisions/summary` | Tổng kết |
| `triggerPatternAnalysis(lang)` | POST | `/api/decisions/summary/pattern` | Tổng kết |
| `saveManualPattern(result)` | POST | `/api/decisions/summary/pattern/manual` | Tổng kết |
| `updatePattern(id, result)` | PUT | `/api/decisions/summary/pattern/:id` | Tổng kết |
| `deletePattern(id)` | DELETE | `/api/decisions/summary/pattern/:id` | Tổng kết |

---

### 3.3 Tab Xếp hạng (Ranking)

> Frontend-only focus theo yêu cầu.

**Components:**

**[BankList.tsx](../frontend/src/components/BankList.tsx)**
- Bảng ngân hàng cho kỳ đang chọn
- Columns: Mã CP, NPL, LLR, LDR, Tăng trưởng DT, Tổng điểm
- Click hàng → cập nhật `selectedBank` lên App.tsx → trigger TrendChart

**[TrendChart.tsx](../frontend/src/components/TrendChart.tsx)**
- Recharts LineChart cho metrics theo thời gian (annual + quarterly)
- 4 series: NPL, LLR, LDR, TangTruongDoanhThu
- Toggle hiện/ẩn từng series
- Chỉ hiển thị data đến kỳ đang chọn

**[RankingChart.tsx](../frontend/src/components/RankingChart.tsx)**
- LineChart điểm tích lũy tất cả ngân hàng × tất cả kỳ
- Mặc định chọn top 5 ngân hàng
- Toggle ngân hàng riêng lẻ
- Fetch `/api/ranking/history` một lần khi mount (không re-fetch theo period)

**[PeriodFilter.tsx](../frontend/src/components/PeriodFilter.tsx)**
- Dropdown chọn Year/Quarter
- Khi thay đổi → trigger refetch BankList + TrendChart

---

### 3.4 Tab Định giá (Valuation)

> Frontend-only focus theo yêu cầu.

**Component:** [ValuationTab.tsx](../frontend/src/components/ValuationTab.tsx)

- Nút "Tính lại MOS" → POST `/api/valuation/run` → polling trạng thái (running/done/error)
- Bảng kết quả: Mã CP, Giá hiện tại, MOS, Tỉ suất sinh lợi, Cập nhật lúc
- Row color-code: xanh (sinh lợi dương), đỏ (âm)
- Sau khi chạy xong → tự động re-fetch để refresh bảng

---

### 3.5 Tab Sàng lọc (Screening)

**Component:** [ScreeningTab.tsx](../frontend/src/components/ScreeningTab.tsx)

**State nội bộ:**
```typescript
const [year, setYear]
const [quarter, setQuarter]
const [results, setResults]   // ScreeningResult[]
const [loading, setLoading]
const [error, setError]
```

**UI Flow:**
1. User chọn Year + Quarter (bắt buộc)
2. Click "Sàng lọc" → `fetchScreening(year, quarter)`
3. Hiển thị 3 summary cards: số lượng MUA / GIỮ / TRÁNH
4. Bảng kết quả sort theo score giảm dần:
   - Mã CP, Điểm Rank (s_rank), Điểm Valuation (s_val), Điểm tổng hợp
   - Giá hiện tại, MOS, Tỉ suất sinh lợi
   - Badge tín hiệu (xanh/vàng/đỏ)
5. Footer giải thích công thức

**Interface `ScreeningResult`:**
```typescript
interface ScreeningResult {
  StockCode: string
  s_rank: number       // 0–100, chuẩn hóa từ totalDiem
  s_val: number        // 0–100, chuẩn hóa từ ti_suat_sinh_loi
  score: number        // 0.5 * s_rank + 0.5 * s_val
  signal: "MUA" | "GIỮ" | "TRÁNH"
  current_price: number | null
  mos: number | null
  ti_suat_sinh_loi: number | null
}
```

---

### 3.6 Tab Quyết định (Decisions)

**Cấu trúc 3-view:**

```
DecisionsTab.tsx
  ├── view="timeline"  → DecisionTimeline.tsx
  ├── view="form"      → DecisionForm.tsx (mode: add | edit)
  └── view="detail"    → DecisionDetail.tsx
```

---

#### DecisionsTab.tsx

[frontend/src/components/decisions/DecisionsTab.tsx](../frontend/src/components/decisions/DecisionsTab.tsx)

Router nội bộ giữa 3 view. Nhận callback từ các sub-component để chuyển view:
- `onAddNew()` → chuyển sang form (mode=add)
- `onEdit(id)` → chuyển sang form (mode=edit)
- `onViewDetail(id)` → chuyển sang detail
- `onBack()` → quay về timeline

---

#### DecisionTimeline.tsx

[frontend/src/components/decisions/DecisionTimeline.tsx](../frontend/src/components/decisions/DecisionTimeline.tsx)

**Bộ lọc:**
```typescript
ticker: string           // Lọc theo mã CP
types: string[]          // BUY | SELL | HOLD | WATCH
asset_types: string[]    // STOCK | GOLD | CRYPTO | SAVINGS
from: string             // Ngày bắt đầu (ISO)
to: string               // Ngày kết thúc (ISO)
```

**Bảng:** Ngày, Mã CP, Loại tài sản, Loại QĐ, Giá vào, Lý do (preview 60 ký tự), Trạng thái review

**Pagination:** limit + offset, có nút Load more

---

#### DecisionForm.tsx

[frontend/src/components/decisions/DecisionForm.tsx](../frontend/src/components/decisions/DecisionForm.tsx)

**Các trường bắt buộc:**
- `asset_type`: STOCK | GOLD | CRYPTO | SAVINGS
- `ticker`: Mã chứng khoán
- `decision_type`: BUY | SELL | HOLD | WATCH
- `decided_at`: Ngày quyết định
- `entry_price`: Giá vào (spinner ±500)
- `quantity`: Số lượng (auto-tính `buy_amount = price × qty`)
- `reason`: Lý do (tối thiểu 20 ký tự)
- `confidence`: Mức độ tự tin (1–5)
- `mood`: Tâm trạng khi ra QĐ

**Risk Plan** (tùy chọn, ẩn với SAVINGS):
```typescript
risk_plan: {
  stop_loss: { value, type: "abs" | "pct" }
  take_profits: Array<{ price, exit_pct }>
  dca_levels: Array<{ price, add_volume }>
  max_portfolio_pct: number
}
```

> **Lưu ý khi thêm trường mới:** Cập nhật đồng thời interface trong `client.ts`, schema `decision_journal` trong database, validation trong `decisionValidation.ts`, và PUT handler trong `decisions.ts`.

---

#### DecisionDetail.tsx

[frontend/src/components/decisions/DecisionDetail.tsx](../frontend/src/components/decisions/DecisionDetail.tsx)

**Sections:**
1. **Header:** Mã CP, loại QĐ, ngày, giá vào, số lượng
2. **Lý do & Risk Plan:** Hiển thị đầy đủ
3. **User Note:** Text area có thể sửa + lưu (PUT `/api/decisions/:id/note`)
4. **Nút Đánh giá:** 2-step flow:
   - Step 1: Fetch giá hiện tại (`/api/decisions/:id/current-price`)
   - Step 2: Confirm dùng giá tự động hay nhập tay
   - Gọi `createReview()` → AI review qua Claude
5. **Manual Review Form:** Nhập verdict + reason thủ công
6. **ReviewCard(s):** Hiển thị từng review với:
   - Verdict badge, Lý do, Điểm mạnh/yếu, Bài học, Price snapshot
7. **Edit / Delete** (soft-delete với xác nhận)

**Interface `Review`:**
```typescript
interface Review {
  id: number
  reviewed_at: string
  verdict: "ĐÚNG" | "SAI" | "CHƯA_RÕ"
  verdict_reason: string
  strengths: string[]
  weaknesses: string[]
  lessons: string[]
  price_snapshot: {
    entry_price: number
    current_price: number
    change_pct: number
    max_price: number
    min_price: number
    sl_hit: boolean
    tp_hits: number[]
  }
  model_id: string | null
}
```

---

### 3.7 Tab Tổng kết (Summary)

**Component:** [DecisionSummary.tsx](../frontend/src/components/decisions/DecisionSummary.tsx)

**State:**
```typescript
const [filterFrom, setFilterFrom]           // ISO date
const [filterTo, setFilterTo]               // ISO date
const [summary, setSummary]                 // DecisionSummaryResponse
const [computing, setComputing]             // Loading state AI pattern
const [showManualForm, setShowManualForm]   // Hiển thị form thêm thủ công
const [manualMistakes, setManualMistakes]   // PatternItem[] — form thủ công
const [manualSuccesses, setManualSuccesses] // PatternItem[] — form thủ công
```

**UI Sections:**

1. **Verdict Bars:**
   ```
   ĐÚNG    ████████████ 60% (12 QĐ)
   SAI     ████ 20% (4 QĐ)
   CHƯA_RÕ ████ 20% (4 QĐ)
   ```

2. **Phân tích pattern:**
   - **Nút "Tính pattern" (AI):** POST `/api/decisions/summary/pattern?lang=vi` — yêu cầu ≥ 5 reviews
   - **Nút "Thêm thủ công":** Mở form inline để nhập pattern không cần AI
   - **PatternCacheList:** Accordion list tất cả patterns đã lưu (mới nhất mở sẵn)
     - Mỗi entry có nút **Sửa** (edit inline) và **Xoá** (confirm trước khi xoá)
     - Chỉ hiện thông báo "chưa có pattern" khi `patternCaches` rỗng

**Sub-components:**
- `PatternCacheList` — accordion list, nhận `onRefresh` callback để reload sau edit/delete
- `ManualPatternForm` — form thêm pattern thủ công (dùng chung `PatternItemList`)
- `PatternItemList` — danh sách item có thể thêm/xoá (top-level để tránh mất focus khi gõ)
- `PatternDisplay` — hiển thị một `PatternResult` (mistakes + successes)

**Interfaces:**
```typescript
interface PatternCacheEntry {
  id: number
  computedAt: string
  result: PatternResult
}

interface PatternResult {
  mistakes: Array<{ description: string; count: number }>
  successes: Array<{ description: string; count: number }>
}

interface DecisionSummaryResponse {
  correct: number
  wrong: number
  unclear: number
  total: number
  patterns: PatternResult | null        // latest (backward compat)
  patternCache: PatternCacheEntry | null // latest
  patternCaches: PatternCacheEntry[]    // toàn bộ lịch sử
}
```

> **Lưu ý:** `PatternItemList` phải là top-level function (không định nghĩa bên trong component khác) để tránh React unmount/remount input mỗi lần gõ ký tự.

---

### 3.8 Internationalization

- **Config:** [frontend/src/i18n.ts](../frontend/src/i18n.ts)
- **Ngôn ngữ:** Tiếng Việt (`vi`), English (`en`), Tiếng Nhật (`ja`)
- **Lưu trữ:** `localStorage` (key `lang`), mặc định `vi`
- **Component:** `LangSwitcher` — dropdown ở header
- AI response từ backend cũng nhận `lang` param để trả về đúng ngôn ngữ

---

## 4. Backend Architecture

### 4.1 Express Server

**File:** [backend/src/index.ts](../backend/src/index.ts)

```
Express App
├── CORS → chỉ allow FRONTEND_URL
├── JSON body parser
└── Routers:
    ├── /api/banks      → banks.ts
    ├── /api/ranking    → ranking.ts
    ├── /api/periods    → periods.ts
    ├── /api/screening  → screening.ts
    ├── /api/valuation  → valuation.ts
    └── /api/decisions  → decisions.ts
```

---

### 4.2 Database Layer

**Connection Pool:** [backend/src/db/connection.ts](../backend/src/db/connection.ts)
- `mysql2/promise` pool
- Config từ `.env`: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

**Helpers:** [backend/src/db/queries.ts](../backend/src/db/queries.ts)
- `parsePeriodParams(query)` → `{ year, quarter } | null` — validate year/quarter từ query string
- `detectCurrentPeriod(pool)` → auto-detect kỳ báo cáo hiện tại (dùng `detectWindow()` hoặc kỳ mới nhất trong DB)

**Xác định kỳ:** [backend/src/lib/detectWindow.ts](../backend/src/lib/detectWindow.ts)
- Q1 = tháng 1–4, Q2 = tháng 5–8, Q3 = tháng 9–10, Q4 = tháng 11–12

---

### 4.3 Schema Database

#### Bảng `bctc_new` — Báo cáo tài chính ngân hàng
```sql
PRIMARY KEY (StockCode, Year, Quarter)
Columns:
  StockCode          VARCHAR -- Mã CP
  Year               INT
  Quarter            INT
  NPL                DECIMAL -- Tỉ lệ nợ xấu (thấp hơn = tốt)
  LLR                DECIMAL -- Tỉ lệ dự phòng (cao hơn = tốt)
  LDR                DECIMAL -- Tỉ lệ cho vay/huy động (thấp hơn = tốt)
  TangTruongDoanhThu DECIMAL -- Tăng trưởng doanh thu (cao hơn = tốt)
  -- ...các cột kế toán khác
```

> **Lưu ý về chiều xếp hạng:**
> - NPL: RANK() ORDER BY ASC (thấp hơn = tốt hơn = điểm thấp)
> - LLR: RANK() ORDER BY DESC (cao hơn = tốt hơn = điểm thấp)
> - LDR: RANK() ORDER BY ASC (thấp hơn = tốt hơn = điểm thấp)
> - TangTruongDoanhThu: RANK() ORDER BY DESC (cao hơn = tốt hơn = điểm thấp)
> - `totalDiem` = sum của 4 rank → **số càng thấp = rank càng tốt**

#### Bảng `paybacktime` — Kết quả định giá
```sql
PRIMARY KEY (StockCode)
Columns:
  StockCode         VARCHAR
  MOS               DECIMAL  -- Margin of Safety (giá trị nội tại)
  current_price     DECIMAL  -- Giá hiện tại
  ti_suat_sinh_loi  DECIMAL  -- (MOS - current_price) / current_price
  updated_at        DATETIME
```

#### Bảng `decision_journal` — Nhật ký quyết định
```sql
PRIMARY KEY (id BIGINT AUTO_INCREMENT)
Columns:
  ticker            VARCHAR
  asset_type        ENUM('STOCK','GOLD','CRYPTO','SAVINGS')
  decision_type     ENUM('BUY','SELL','HOLD','WATCH')
  decided_at        DATE
  entry_price       DECIMAL
  quantity          DECIMAL
  buy_amount        DECIMAL   -- = entry_price × quantity
  risk_plan         JSON      -- stop_loss, take_profits, dca_levels, max_portfolio_pct
  reason            TEXT      -- tối thiểu 20 ký tự
  confidence        TINYINT   -- 1–5
  mood              VARCHAR
  user_note         TEXT      -- ghi chú sau khi review
  created_at        DATETIME
  updated_at        DATETIME
  deleted_at        DATETIME  -- NULL = còn tồn tại (soft-delete)

Indexes:
  (ticker, decided_at)
  decision_type
  deleted_at
```

#### Bảng `decision_review` — Reviews (AI + manual)
```sql
PRIMARY KEY (id BIGINT AUTO_INCREMENT)
FOREIGN KEY decision_id → decision_journal.id ON DELETE CASCADE

Columns:
  decision_id    BIGINT
  reviewed_at    DATETIME
  verdict        ENUM('ĐÚNG','SAI','CHƯA_RÕ')
  verdict_reason TEXT
  strengths      JSON   -- string[]
  weaknesses     JSON   -- string[]
  lessons        JSON   -- string[]
  price_snapshot JSON   -- {entry_price, current_price, change_pct, max_price, min_price, sl_hit, tp_hits}
  model_id       VARCHAR  -- 'claude-sonnet-4-6' hoặc null nếu manual
  prompt_hash    VARCHAR  -- hash của prompt (tránh review trùng)
```

#### Bảng `decision_pattern_cache` — Cache phân tích pattern
```sql
PRIMARY KEY (id)
Columns:
  computed_at  DATETIME
  result       JSON   -- {mistake_patterns, success_patterns}
```

---

### 4.4 Route: Sàng lọc — `/api/screening`

**File:** [backend/src/routes/screening.ts](../backend/src/routes/screening.ts)

**Config:** [backend/src/config/screeningConfig.ts](../backend/src/config/screeningConfig.ts)
```typescript
MUA_THRESHOLD = 65    // score >= 65 → MUA
GIU_THRESHOLD = 40    // 40 <= score < 65 → GIỮ
                      // score < 40 → TRÁNH
TI_CAP = 0.5         // Clamp ti_suat_sinh_loi vào [-0.5, +0.5]
WEIGHT_RANK = 0.5    // Trọng số điểm rank
WEIGHT_VAL = 0.5     // Trọng số điểm valuation
```

**GET `/api/screening?year=Y&quarter=Q`** _(year, quarter bắt buộc)_

**Thuật toán 6 bước:**

```
1. Lấy totalDiem của tất cả ngân hàng cho kỳ (year, quarter)
   SELECT StockCode, totalDiem FROM bctc_new ... RANK() OVER ...

2. Lấy valuation data từ paybacktime
   SELECT StockCode, ti_suat_sinh_loi, current_price, MOS FROM paybacktime

3. Chuẩn hóa s_rank (0–100):
   s_rank = 100 × (max_diem - totalDiem) / (max_diem - min_diem)
   (totalDiem thấp = rank tốt hơn → s_rank cao hơn)

4. Chuẩn hóa s_val (0–100):
   ti = clamp(ti_suat_sinh_loi, -0.5, +0.5)
   s_val = 100 × (ti + 0.5) / (0.5 + 0.5)
   (ti_suat_sinh_loi = +0.5 → s_val = 100; = -0.5 → s_val = 0)

5. Điểm tổng hợp:
   score = 0.5 × s_rank + 0.5 × s_val

6. Tín hiệu:
   score >= 65 → "MUA"
   score >= 40 → "GIỮ"
   else        → "TRÁNH"
```

**Response:**
```typescript
[{
  StockCode: string
  totalDiem: number         // Tổng điểm rank (thấp = tốt)
  s_rank: number            // 0–100
  ti_suat_sinh_loi: number  // Tỉ suất thô từ valuation
  s_val: number             // 0–100
  score: number             // Điểm tổng hợp
  signal: "MUA" | "GIỮ" | "TRÁNH"
  current_price: number | null
  mos: number | null
}]
// Sorted by score DESC
```

> **Khi muốn thay đổi công thức:** Sửa các hằng số trong `screeningConfig.ts`. Không cần đụng vào logic route.

---

### 4.5 Route: Quyết định — `/api/decisions`

**File:** [backend/src/routes/decisions.ts](../backend/src/routes/decisions.ts)

#### Danh sách endpoints:

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/decisions` | Danh sách có phân trang + filter |
| GET | `/api/decisions/:id` | Chi tiết 1 quyết định kèm reviews |
| POST | `/api/decisions` | Tạo mới |
| PUT | `/api/decisions/:id` | Cập nhật |
| DELETE | `/api/decisions/:id` | Soft-delete |
| PUT | `/api/decisions/:id/note` | Cập nhật ghi chú |
| GET | `/api/decisions/:id/current-price` | Lấy giá hiện tại |
| POST | `/api/decisions/:id/reviews` | Tạo review (AI hoặc manual) |
| GET | `/api/decisions/summary` | Thống kê verdicts + toàn bộ pattern cache |
| POST | `/api/decisions/summary/pattern` | Phân tích pattern qua AI |
| POST | `/api/decisions/summary/pattern/manual` | Lưu pattern thủ công (không dùng AI) |
| PUT | `/api/decisions/summary/pattern/:id` | Cập nhật pattern theo id |
| DELETE | `/api/decisions/summary/pattern/:id` | Xoá pattern theo id |

> **Lưu ý thứ tự route:** Các route `/summary/*` phải đăng ký **trước** `/:id` để Express không nhầm `summary` thành một `:id`.

---

#### GET `/api/decisions` — Danh sách

Query params:
```
ticker       ?ticker=VCB
type         ?type=BUY (hoặc nhiều: BUY,SELL)
asset_type   ?asset_type=STOCK
from         ?from=2024-01-01
to           ?to=2024-12-31
limit        default 20
offset       default 0
```

SQL pattern:
```sql
SELECT dj.*, COUNT(dr.id) as review_count
FROM decision_journal dj
LEFT JOIN decision_review dr ON dr.decision_id = dj.id
WHERE dj.deleted_at IS NULL
  AND (filters...)
GROUP BY dj.id
ORDER BY dj.decided_at DESC
LIMIT ? OFFSET ?
```

---

#### POST `/api/decisions/:id/reviews` — Tạo review

Body có thể là:
```typescript
// AI review (mode mặc định)
{
  current_price?: number    // Nếu không có, tự fetch từ priceService
  lang?: "vi" | "en" | "ja"
}

// Manual review
{
  mode: "manual"
  verdict: "ĐÚNG" | "SAI" | "CHƯA_RÕ"
  verdict_reason: string
  lang?: string
}
```

**AI Review Flow:**
```
1. Fetch decision từ DB (id)
2. Nếu không có current_price → gọi priceService.getCurrentPrice(ticker)
3. Fetch lịch sử giá → buildPriceSnapshot() (tính max/min/SL hit/TP hits)
4. Gọi aiService.reviewDecision(decision, priceSnapshot, lang)
   → Claude trả về JSON: {verdict, verdict_reason, strengths[], weaknesses[], lessons[]}
5. Validate JSON schema (retry 1 lần nếu invalid)
6. INSERT vào decision_review
7. Return review đầy đủ
```

---

#### GET `/api/decisions/summary` — Thống kê

Query params: `from`, `to` (tùy chọn)

```sql
-- Verdict counts (lấy review mới nhất của mỗi QĐ)
SELECT verdict, COUNT(*) FROM decision_review dr
JOIN decision_journal dj ON dj.id = dr.decision_id
WHERE dj.deleted_at IS NULL AND dr.reviewed_at = (
  SELECT MAX(reviewed_at) FROM decision_review WHERE decision_id = dj.id
)
GROUP BY verdict

-- Toàn bộ pattern cache, mới nhất trước
SELECT * FROM decision_pattern_cache ORDER BY computed_at DESC
```

`result` từ DB được `JSON.parse()` trước khi trả về nếu là string (TEXT column).

Response:
```typescript
{
  correct: number
  wrong: number
  unclear: number
  total: number
  patterns: PatternResult | null        // latest (backward compat)
  patternCache: PatternCacheEntry | null // latest
  patternCaches: PatternCacheEntry[]    // toàn bộ lịch sử, mới nhất đầu tiên
}
```

---

#### POST `/api/decisions/summary/pattern` — Phân tích pattern (AI)

Query: `lang=vi|en|ja`

```
1. Lấy tất cả weaknesses + lessons từ mọi reviews (không xóa mềm)
2. Nếu < 5 reviews → 400 insufficient_data
3. Gom thành văn bản → aiService.analyzePatterns(text, lang)
4. Claude trả về: { mistakes: [{description, count}], successes: [{description, count}] }
5. INSERT vào decision_pattern_cache
6. Return { result, computedAt }
```

> **Lưu ý:** Chỉ nên gọi khi có ≥ 5 reviews. Frontend đã check điều kiện này trước khi cho phép bấm nút.

---

#### POST `/api/decisions/summary/pattern/manual` — Thêm pattern thủ công

Body:
```typescript
{
  mistakes: Array<{ description: string; count: number }>
  successes: Array<{ description: string; count: number }>
}
```

Lưu thẳng vào `decision_pattern_cache` không qua AI. Return `{ result, computedAt }`.

---

#### PUT `/api/decisions/summary/pattern/:id` — Cập nhật pattern

Body giống POST manual. Cập nhật `result` của row có `id` tương ứng.

---

#### DELETE `/api/decisions/summary/pattern/:id` — Xoá pattern

Xoá cứng (hard-delete) row khỏi `decision_pattern_cache`.

---

### 4.6 Các Service quan trọng

#### aiService.ts

[backend/src/lib/aiService.ts](../backend/src/lib/aiService.ts)

- **Model:** `claude-sonnet-4-6`
- **`reviewDecision(decision, priceSnapshot, lang)`**
  - Prompt mô tả ngữ cảnh quyết định + diễn biến giá
  - Yêu cầu Claude trả về JSON strict schema
  - Retry 1 lần nếu JSON invalid
- **`analyzePatterns(text, lang)`**
  - Gom tất cả lessons/weaknesses thành 1 đoạn văn
  - Claude nhóm thành mistake patterns + success patterns

#### priceService.ts

[backend/src/lib/priceService.ts](../backend/src/lib/priceService.ts)

- Nguồn dữ liệu: **Vietstock** (cần `VIETSTOCK_COOKIE` + `VIETSTOCK_TOKEN` trong `.env`)
- **`getCurrentPrice(ticker)`** → giá + % thay đổi
- **`getHistoricalPrices(ticker, from, to)`** → OHLCV[]
- **`buildPriceSnapshot(decision, currentPrice, historicalPrices)`**
  - So sánh giá vào vs giá hiện tại
  - Tính max/min giá kể từ ngày quyết định
  - Check xem SL đã bị hit chưa
  - Check TP nào đã đạt

#### decisionValidation.ts

[backend/src/lib/decisionValidation.ts](../backend/src/lib/decisionValidation.ts)

- Validate các trường bắt buộc khi POST/PUT decision
- `reason` phải ≥ 20 ký tự
- `confidence` phải từ 1–5
- `entry_price` và `quantity` phải dương

---

## 5. Data Flow Diagrams

### 5.1 Sàng lọc

```
User chọn Year + Quarter
        │
        ▼
ScreeningTab.tsx
→ fetchScreening(year, quarter)
        │
        ▼
GET /api/screening?year=Y&quarter=Q
        │
        ▼
screening.ts (backend)
  ├── Query bctc_new → RANK() OVER → totalDiem[]
  ├── Query paybacktime → ti_suat_sinh_loi[]
  ├── LEFT JOIN (có thể thiếu paybacktime cho 1 số CP)
  ├── Normalize s_rank (0–100)
  ├── Normalize s_val (0–100, clamp ±0.5)
  ├── score = 0.5 × s_rank + 0.5 × s_val
  └── Assign signal (MUA/GIỮ/TRÁNH)
        │
        ▼
Response: ScreeningResult[]
        │
        ▼
ScreeningTab.tsx
  ├── Summary cards (count MUA/GIỮ/TRÁNH)
  └── Bảng kết quả sort by score DESC
```

---

### 5.2 Quyết định — Thêm & Đánh giá

```
[THÊM MỚI]
User điền DecisionForm
→ createDecision(data)
→ POST /api/decisions
  ├── decisionValidation.ts → validate
  ├── INSERT decision_journal
  └── Return {id, ...}
→ DecisionsTab chuyển về view="timeline"

[ĐÁNH GIÁ]
User ở DecisionDetail
→ Bấm "Đánh giá"

Step 1: fetchCurrentPrice(id)
→ GET /api/decisions/:id/current-price
  └── Query paybacktime WHERE StockCode = ticker
  └── Return {currentPrice, changePct, fetchedAt}

Step 2: User xác nhận giá (auto hoặc manual)
→ createReview({current_price, lang})
→ POST /api/decisions/:id/reviews

Backend:
  ├── Fetch decision từ DB
  ├── priceService.getHistoricalPrices(ticker, decided_at, now)
  ├── priceService.buildPriceSnapshot(decision, currentPrice, history)
  ├── aiService.reviewDecision(decision, snapshot, lang)
  │   └── Claude API → JSON {verdict, reason, strengths, weaknesses, lessons}
  ├── Validate JSON (retry nếu lỗi)
  └── INSERT decision_review

→ DecisionDetail re-fetch → hiển thị ReviewCard mới
```

---

### 5.3 Tổng kết — Phân tích pattern

```
User vào tab Tổng kết
→ fetchDecisionSummary(from, to)
→ GET /api/decisions/summary

Backend:
  ├── Đếm verdicts (ĐÚNG/SAI/CHƯA_RÕ)
  └── SELECT * FROM decision_pattern_cache ORDER BY computed_at DESC
      (JSON.parse result nếu là string)

→ Hiển thị verdict bars
→ PatternCacheList: accordion tất cả patterns (mới nhất mở sẵn)

[Nút "Tính pattern" — AI]
→ triggerPatternAnalysis(lang)
→ POST /api/decisions/summary/pattern?lang=vi
  ├── Cần ≥ 5 reviews, không thì 400
  ├── SELECT weaknesses, lessons FROM decision_review
  ├── aiService.analyzePatterns(text, lang) → Claude API
  └── INSERT vào decision_pattern_cache
→ load() → PatternCacheList cập nhật

[Nút "Thêm thủ công"]
→ Mở ManualPatternForm ở đầu danh sách
→ User nhập mistakes[] + successes[]
→ saveManualPattern(result)
→ POST /api/decisions/summary/pattern/manual
  └── INSERT vào decision_pattern_cache (không qua AI)
→ load() → PatternCacheList cập nhật

[Nút Sửa trên một entry]
→ Mở edit form inline trong accordion entry đó
→ updatePattern(id, result)
→ PUT /api/decisions/summary/pattern/:id
→ load() → PatternCacheList cập nhật

[Nút Xoá trên một entry]
→ window.confirm()
→ deletePattern(id)
→ DELETE /api/decisions/summary/pattern/:id
→ load() → PatternCacheList cập nhật
```

---

## 6. Biến môi trường

### Backend `.env`
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=...
DB_NAME=bank_dashboard

FRONTEND_URL=http://localhost:5173

ANTHROPIC_API_KEY=sk-ant-...    # Claude AI

VIETSTOCK_COOKIE=...             # Lấy giá chứng khoán
VIETSTOCK_TOKEN=...
```

### Frontend `.env`
```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## 7. Quy ước đặt tên & Pattern quan trọng

### Soft-delete
Decisions không bao giờ bị xóa cứng. Mọi query đều có `WHERE deleted_at IS NULL`.

```sql
-- Xóa
UPDATE decision_journal SET deleted_at = NOW() WHERE id = ?

-- Lấy danh sách
SELECT ... FROM decision_journal WHERE deleted_at IS NULL
```

### Period routing
Hầu hết endpoints hỗ trợ `?year=Y&quarter=Q`. Nếu không truyền → auto-detect kỳ hiện tại qua `detectCurrentPeriod()`. Response thường kèm meta `{ detectedPeriod: {year, quarter} }`.

### Window functions (MySQL 8.0+)
Ranking dùng `RANK() OVER (PARTITION BY Year, Quarter ORDER BY ...)`. Nếu chạy MySQL < 8.0 sẽ lỗi.

### Chiều rank
`totalDiem` là **tổng rank số**, **thấp hơn = tốt hơn**. Khi chuẩn hóa sang `s_rank` (0–100), công thức đảo lại: `s_rank = 100 × (max - totalDiem) / (max - min)`.

### AI retry logic
`aiService.ts` retry 1 lần nếu Claude trả về JSON không hợp lệ. Nếu vẫn lỗi sau retry → throw để route handler trả về 500.

### Review per decision
Một quyết định có thể có nhiều reviews (AI hoặc manual). `DecisionSummary` chỉ tính **review mới nhất** của mỗi quyết định để đếm verdict, tránh đếm trùng.
