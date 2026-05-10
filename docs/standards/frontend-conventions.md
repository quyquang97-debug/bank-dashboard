# Frontend Conventions — bank-dashboard

**Version**: 1.0 (Phase 2 — init-web-dashboard)  
**Date**: 2026-05-08

---

## 1. Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 (functional components + hooks) |
| Build tool | Vite |
| Language | TypeScript (strict) |
| Charts | Recharts (recommended — good React integration, handles null gaps) |
| Styling | CSS Modules or plain CSS (no CSS-in-JS) |
| HTTP | native `fetch` (no axios dependency) |

---

## 2. Component Structure

```
App
├── BankList          — table, triggers bank selection
├── TrendChart        — shown when a bank is selected
│   ├── AnnualChart   — Recharts LineChart (Quarter=0 data)
│   └── QuarterChart  — Recharts LineChart (Quarter=1-4 data)
└── RankingChart      — Recharts BarChart (horizontal)
```

---

## 3. NULL / 0 Display Rules

| Value | Display in table | Display in chart |
|-------|-----------------|-----------------|
| `null` | `"—"` | Omit point (connectNulls=false) |
| `0` | `"0.00%"` | Plot as 0 (not treated as null) |
| Positive number | formatted with 2 decimal places + "%" | Plot normally |

---

## 4. Empty State Rules

| Condition | UI Behavior |
|-----------|------------|
| `bctc_new` empty | All 3 sections show "Không có dữ liệu" message |
| No bank selected | Trend area shows placeholder: "Chọn một ngân hàng từ danh sách để xem xu hướng" |
| No annual data for selected bank | Hide Chart A, show "Chưa có dữ liệu báo cáo năm" |
| No quarterly data for selected bank | Hide Chart B, show "Chưa có dữ liệu báo cáo quý" |
| Single data point in trend | Show dot only, no line — Recharts handles this naturally with `dot={true}` |

---

## 5. Trend Chart Toggle

Each of the 5 lines (NPL, LLR, LDR, TangTruongDoanhThu, total_diem) is individually toggleable.  
State: array of booleans or a Set of active metric keys.  
Default: all 5 lines visible.

---

## 6. Responsive / Layout

- Minimum supported width: 1280px.
- Mobile is out-of-scope — do not add responsive breakpoints unless requested.
- Use a simple vertical layout: Bank List → Trend (appears on bank click) → Ranking.

---

## 7. API Calls

All API calls go through `frontend/src/api/client.ts`.  
Base URL: `import.meta.env.VITE_API_BASE_URL` (default: `http://localhost:3001`).  
Handle loading + error states in each component — do not leave components in a blank/crash state on API failure.

---

## 8. Naming

- Component files: `PascalCase.tsx`
- Hook files: `use<Name>.ts`
- API client functions: `camelCase`, e.g. `fetchBanks()`, `fetchTrend(code)`, `fetchRanking()`
- CSS classes: `kebab-case`

---

## 9. No Business Logic in Components

- RANK computation → API
- Period detection (`detectWindow`) → API
- NULL coercion → never (pass null through, let render layer format)
