# Implementation Plan — paybacktime (Tab "Định Giá")

**Version**: 1.0  
**Date**: 2026-05-10  
**Spec**: `docs/changes/paybacktime-estimate/spec-pack.md` v1.1  
**Branch target**: `develop`

---

## 1. Policy

### 1.1 Nguyên tắc chung

- **Spec is law**: chỉ làm những gì có trong spec-pack. Phát sinh ngoài spec → ghi vào Open Issue, không tự thêm.
- **1 step = 1 unit có thể review**: mỗi implementation step phải đủ nhỏ để reviewer đọc diff trong < 5 phút.
- **Không sửa `/paybacktime/`**: mọi integration đều là one-way import — backend gọi vào paybacktime, không ngược lại. Ngoại lệ duy nhất: xem blocker B-1 bên dưới.
- **No business logic trên frontend**: formatting (%, locale string) được tính trực tiếp trong JSX, không tạo helper file riêng trừ khi cần test.
- **Error boundary per component**: ValuationTab tự xử lý tất cả error states; App.tsx không cần try/catch cho tab valuation.

### 1.2 Approach đã chọn (với lý do)

| Quyết định | Approach | Lý do |
|-----------|---------|-------|
| Per-bank execution | `Promise.allSettled` với 1 ngân hàng/lần gọi `runPaybacktime` | Spec NFR-6: fail-fast bị loại; skip-and-continue |
| Concurrent lock | Module-level `isRunning` flag trong `valuation.ts` | Spec NFR-5; stateless route không đủ |
| Timeout | `AbortController` + `setTimeout` phía frontend, 10s | Spec NFR-4; backend không có server-side timeout |
| Tab state | `useState` trong App.tsx, render conditional | Không cần router vì chỉ có 2 tab |
| Unmount cleanup | `useEffect` return `controller.abort()` | Hủy request khi user switch tab trước khi POST xong |

---

## 2. Pre-Implementation Checklist — BẮT BUỘC XÁC NHẬN TRƯỚC KHI CODE

> Các mục dưới đây là **blockers** hoặc **cần quyết định** trước khi bắt đầu implementation. Không thể bỏ qua.

### B-1 [RESOLVED] Import path bị vỡ trong `paybacktime/runPaybacktime.ts`

**Vấn đề**: `runPaybacktime.ts` có import path `../../database/saveMos.ts` bị vỡ khi chạy từ context `bank-dashboard/` (path này được viết cho `bank-analysis/src/paybacktime/`). Backend sẽ crash khi import module.

**Quyết định**: **Option B** — Không import `runPaybacktime`. Trong `valuation.ts`, tự import `calMos` và `GetTradeInfo` trực tiếp từ `paybacktime/`, replicate logic per-bank inline.

**Sub-decision**: DB logic (`saveMos`) được copy vào `backend/src/lib/saveMos.ts` (không import từ `database/`). Bản copy trong backend sẽ dùng `pool` từ `connection.ts` (mysql2/promise) thay vì tạo connection mới mỗi lần như bản gốc.

**Không sửa bất kỳ file nào trong `/paybacktime/` và `/database/`.**

---

### B-2 [BLOCKER] Spec có import path sai

**Vấn đề**: Spec Section 5.3 ghi:
```
runPaybacktime từ ../../../../paybacktime/runPaybacktime.ts
calMos từ ../../../../paybacktime/CalMos.ts
```
Từ `backend/src/routes/valuation.ts`, 4 cấp lên = `finance/paybacktime/` (không tồn tại). Đúng là **3 cấp**: `../../../paybacktime/`.

**Kết luận**: Sẽ dùng `../../../paybacktime/runPaybacktime.ts` và `../../../paybacktime/CalMos.ts` khi implement. Không cần user quyết định — đây là lỗi đánh máy trong spec.

---

### B-3 [BLOCKER] `axios` không có trong `backend/package.json`

**Vấn đề**: `paybacktime/GetTradeInfo.ts` import `axios`. Backend hiện chỉ có `cors, dotenv, express, mysql2`. Khi backend import `GetTradeInfo.ts`, Node.js sẽ fail với "Cannot find package 'axios'".

**Fix**: Thêm `axios` vào `backend/dependencies` trước khi implement.

**→ Step 1 của implementation.**

---

### B-4 [RISK] `backend/tsconfig.json` có `rootDir: "src"`

**Vấn đề**: `rootDir: "src"` ngăn `tsc` compile files ngoài `src/`. Nếu `valuation.ts` import từ `../../../paybacktime/`, lệnh `npm run build` sẽ fail.

**Dev mode** (`tsx watch`): không bị ảnh hưởng — `tsx` không enforce `rootDir`.

**Options**:
- **[Option A — Recommended]** Xóa `rootDir: "src"`, giữ `outDir: "dist"`, đổi `include` thành `["src", "../paybacktime", "../database"]`. Adjust `outDir` structure nếu cần.
- **[Option B]** Chấp nhận `npm run build` bị broken trong phase này (chỉ dùng dev mode). Document là known limitation.

**→ Cần user quyết định. Nếu Option A, thực hiện ở Step 2.**

---

### B-5 [RISK] Cookie trong `GetTradeInfo.ts` có thể đã hết hạn

**Vấn đề**: Session cookie hardcode trong `GetTradeInfo.ts` (`ASP.NET_SessionId`, `__RequestVerificationToken`...). Cookie này expire sau vài ngày/giờ → mọi call đến Vietstock API sẽ fail → tất cả 17 ngân hàng bị skip → `POST /api/valuation/run` trả `200 { success: true, skipped: [...17 banks...] }` → `GET /api/valuation` trả về data cũ (hoặc `[]`).

**Không phải blocker cho implementation**, nhưng cần refresh cookie trước khi demo. Việc refresh cookie thuộc về `paybacktime/GetTradeInfo.ts` (out of scope).

---

### B-6 [INFO] `saveMos.ts` dùng `mysql2` callback interface

**Vấn đề**: `database/saveMos.ts` import `mysql2` (không phải `mysql2/promise`). `connection.execute()` trên callback interface không return Promise natively. Tuy nhiên, CLI đã được xác nhận là hoạt động trong `bank-analysis` context — mysql2 v3+ hỗ trợ `await` trên `execute` ngay cả với callback interface trong một số cases.

**Kết luận**: Giả định works (CLI đã test). Sẽ verify khi chạy POST lần đầu. Đây không phải blocker cho code implementation.

---

### B-7 [RESOLVED] `.env` loading trong CalMos

**Quyết định**: `.env` nằm tại `backend/.env`. Backend start từ `backend/` dir (`npm run dev` trong `backend/`). `dotenv/config` trong `CalMos.ts` load từ `process.cwd()` = `backend/` → tìm đúng `backend/.env`. `dotenv.config()` trong `index.ts` cũng load cùng file → không xung đột. `saveMos` trong backend lib cũng dùng `process.env` → đúng.

---

## 3. Impact Analysis

### 3.1 Files/Modules bị ảnh hưởng

| File | Loại thay đổi | Ghi chú |
|------|--------------|---------|
| `backend/package.json` | Thêm dependency `axios` | B-3 |
| `backend/tsconfig.json` | Sửa `rootDir`, `include` | B-4 (nếu Option A) |
| `backend/src/index.ts` | Thêm import + mount `valuationRouter` | 1 route mount |
| `backend/src/lib/saveMos.ts` | **Tạo mới** | Copy từ `database/saveMos.ts`, dùng pool thay vì new connection |
| `backend/src/routes/valuation.ts` | **Tạo mới** | POST + GET |
| `frontend/src/api/client.ts` | Thêm 2 hàm: `runValuation()`, `fetchValuation()` | |
| `frontend/src/components/ValuationTab.tsx` | **Tạo mới** | Full component |
| `frontend/src/App.tsx` | Thêm tab state + tab navigator + conditional render | |
| `frontend/src/App.css` (hoặc inline style) | Thêm tab navigator CSS + row color | |
| `paybacktime/runPaybacktime.ts` | Sửa 1 dòng import | **Nếu B-1 Option A** |

### 3.2 Files KHÔNG bị ảnh hưởng

| File | Lý do |
|------|-------|
| `paybacktime/runPaybacktime.ts` | Không import — B-1 Option B |
| `paybacktime/CalMos.ts` | Read-only import trực tiếp vào `valuation.ts` |
| `paybacktime/GetTradeInfo.ts` | Read-only import trực tiếp vào `valuation.ts` |
| `database/saveMos.ts` | Không import — logic được copy vào `backend/src/lib/saveMos.ts` |
| `backend/src/routes/banks.ts` | Không thay đổi |
| `backend/src/routes/ranking.ts` | Không thay đổi |
| `backend/src/routes/periods.ts` | Không thay đổi |
| `backend/src/db/connection.ts` | GET /api/valuation dùng pool này |
| `frontend/src/components/BankList.tsx` | Không thay đổi |
| `frontend/src/components/TrendChart.tsx` | Không thay đổi |
| `frontend/src/components/RankingChart.tsx` | Không thay đổi |
| `frontend/src/components/PeriodFilter.tsx` | Không thay đổi |

### 3.3 DB

| Object | Loại | Ghi chú |
|--------|------|---------|
| Table `paybacktime` | Read + Upsert | `saveMos.ts` đã tạo sẵn logic INSERT ON DUPLICATE KEY UPDATE |
| Schema `paybacktime` | Không tạo mới | Bảng đã tồn tại (CLI đã chạy trước đó) |

---

## 4. Implementation Steps

> **Thứ tự bắt buộc**: Step 1–3 là setup, Step 4–6 là backend, Step 7–9 là frontend.  
> Mỗi step có thể commit riêng và review độc lập.

---

### Step 1 — Thêm `axios` vào backend dependencies

**File**: `backend/package.json`  
**Thay đổi**: Thêm `"axios": "^1.6.0"` vào `dependencies`.  
**Command**: `cd backend && npm install axios`  
**Verify**: `backend/node_modules/axios` tồn tại.

---

### Step 2 — Sửa `backend/tsconfig.json` (nếu B-4 Option A)

**File**: `backend/tsconfig.json`  
**Thay đổi**:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "dist",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "../paybacktime", "../database"]
}
```
**Lý do**: Xóa `rootDir: "src"` để tsc có thể compile files import từ `../paybacktime/` và `../database/`. Thêm `include` explicit để tsc biết compile những folder nào.  
**Verify**: `tsc --noEmit` không báo lỗi về rootDir.

---

### Step 3 — Tạo `backend/src/lib/saveMos.ts`

**File**: `backend/src/lib/saveMos.ts` (tạo mới)

Logic copy từ `database/saveMos.ts`, nhưng:
- Dùng `pool` từ `connection.ts` (mysql2/promise) thay vì tạo connection mới mỗi lần.
- Chỉ xử lý bảng `paybacktime` (numberOfYear = 8) — không cần phân nhánh 6-year vì out of scope.
- TypeScript strict: thêm types cho params.

```typescript
import { pool } from "../db/connection.js";

export async function saveMos(
  stockCode: string,
  mos: number,
  currentPrice: number
): Promise<void> {
  const sql =
    "INSERT INTO `paybacktime` (`StockCode`, `MOS`, `current_price`, `ti_suat_sinh_loi`) " +
    "VALUES (?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE `MOS` = ?, `current_price` = ?, `ti_suat_sinh_loi` = ?, `updated_at` = CURRENT_TIMESTAMP";

  await pool.execute(sql, [
    stockCode, mos, currentPrice, mos / currentPrice,
    mos, currentPrice, mos / currentPrice,
  ]);
}
```

**Tại sao pool tốt hơn new connection**: Tránh overhead tạo/đóng connection 17 lần; pool tái sử dụng connection hiện có của backend.

**Verify**: TypeScript không báo lỗi. Hàm có thể gọi độc lập với đúng params.

---

### Step 4 — Tạo `backend/src/routes/valuation.ts` — POST handler

**File**: `backend/src/routes/valuation.ts` (tạo mới)

Không import `runPaybacktime`. Replicate logic per-bank trực tiếp trong route, dùng:
- `calMos` từ `../../../paybacktime/CalMos.js`
- `GetTradeInfo` từ `../../../paybacktime/GetTradeInfo.js`
- `saveMos` từ `../lib/saveMos.js` (backend copy, Step 3)

```typescript
import { Router, Request, Response } from "express";
import { calMos } from "../../../paybacktime/CalMos.js";
import { GetTradeInfo } from "../../../paybacktime/GetTradeInfo.js";
import { saveMos } from "../lib/saveMos.js";

export const valuationRouter = Router();

const StockCodeList = [
  'ACB','BID','CTG','HDB','LPB','MBB','MSB','SHB',
  'STB','TCB','TPB','VCB','VIB','VPB','SSB','BVB','NAB',
];

let isRunning = false;

valuationRouter.post("/run", async (_req: Request, res: Response) => {
  if (isRunning) {
    return res.status(409).json({ success: false, error: "concurrent_run" });
  }
  isRunning = true;
  try {
    const results = await Promise.allSettled(
      StockCodeList.map(async code => {
        const mos = await calMos(code);
        const currentPrice = await GetTradeInfo(code);
        await saveMos(code, mos, currentPrice);
      })
    );
    const skipped = StockCodeList.filter((_, i) => results[i].status === "rejected");
    if (skipped.length > 0) {
      console.error("Valuation skipped banks:", skipped);
    }
    return res.json({ success: true, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  } finally {
    isRunning = false;
  }
});
```

**Lưu ý `calMos` type**: `CalMos.ts` khai báo param là `String` (wrapper object) thay vì `string`. Khi gọi `calMos(code)` với `code: string` (primitive), TypeScript strict mode có thể báo lỗi. Nếu xảy ra: cast `calMos(code as unknown as String)` hoặc `calMos(code)` tùy theo tsc thực tế. Không sửa `CalMos.ts`.

**Verify**: TypeScript compiles; POST trả 200 khi `isRunning = false`; POST thứ 2 trong khi chạy → 409.

---

### Step 5 — Thêm GET handler vào `backend/src/routes/valuation.ts`

**Thêm vào cuối file** `backend/src/routes/valuation.ts`:

```typescript
valuationRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT StockCode, MOS, current_price, ti_suat_sinh_loi, updated_at FROM paybacktime ORDER BY ti_suat_sinh_loi DESC"
    );
    return res.json({ data: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});
```

**Lý do tách Step 4 và 5**: Reviewer có thể đọc POST logic độc lập với GET logic.  
**Verify**: `GET /api/valuation` với bảng có data → trả đúng schema.

---

### Step 6 — Mount `valuationRouter` trong `backend/src/index.ts`

**File**: `backend/src/index.ts`  
**Thêm**:
```typescript
import { valuationRouter } from "./routes/valuation.js";
// ...
app.use("/api/valuation", valuationRouter);
```
**Verify**: `GET /api/valuation` và `POST /api/valuation/run` trả 200 (không 404).

---

### Step 7 — Thêm API functions vào `frontend/src/api/client.ts`

**Thêm 2 hàm**:
```typescript
export async function runValuation(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/valuation/run`, { method: "POST", signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(`/api/valuation/run failed: ${res.status}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return res.json();
}

export async function fetchValuation(signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/valuation`, { signal });
  if (!res.ok) throw new Error(`/api/valuation failed: ${res.status}`);
  return res.json();
}
```

**Lý do throw với `.status`**: ValuationTab cần phân biệt 409 vs 5xx để hiển thị đúng message.  
**Verify**: TypeScript không báo lỗi.

---

### Step 8 — Tạo `frontend/src/components/ValuationTab.tsx` — skeleton + loading state

**Tạo mới** `frontend/src/components/ValuationTab.tsx`:

```typescript
import { useEffect, useState } from "react";
import { runValuation, fetchValuation } from "../api/client";

type ValuationRow = {
  StockCode: string;
  MOS: number | null;
  current_price: number | null;
  ti_suat_sinh_loi: number | null;
  updated_at: string | null;
};

type UIState =
  | { kind: "loading" }
  | { kind: "concurrent" }
  | { kind: "timeout" }
  | { kind: "error" }
  | { kind: "result"; rows: ValuationRow[] };

export function ValuationTab() {
  const [ui, setUi] = useState<UIState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    (async () => {
      try {
        await runValuation(controller.signal);
        if (controller.signal.aborted) return;
        const data = await fetchValuation(controller.signal);
        if (!controller.signal.aborted) {
          setUi({ kind: "result", rows: data.data ?? [] });
        }
      } catch (err: any) {
        if (controller.signal.aborted) {
          setUi({ kind: "timeout" });
          return;
        }
        if (err?.status === 409) {
          setUi({ kind: "concurrent" });
        } else if (err?.status >= 500) {
          setUi({ kind: "error" });
        } else {
          setUi({ kind: "error" });
        }
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return (
    <div style={{ minHeight: "200px", position: "relative" }}>
      {ui.kind === "loading" && (
        <p>Đang tính toán định giá...</p>
      )}
      {ui.kind === "concurrent" && (
        <p>Đang có phiên tính toán khác đang chạy, vui lòng đợi.</p>
      )}
      {ui.kind === "timeout" && (
        <p>Tính toán quá thời gian (10s), vui lòng thử lại.</p>
      )}
      {ui.kind === "error" && (
        <p>Lỗi tính toán, vui lòng thử lại.</p>
      )}
      {ui.kind === "result" && (
        <ValuationTable rows={ui.rows} />
      )}
    </div>
  );
}
```

**Verify**: Lần đầu render: "Đang tính toán định giá..." xuất hiện ngay; không có unhandled promise rejection.

---

### Step 9 — Thêm `ValuationTable` vào `ValuationTab.tsx`

**Thêm vào cuối file** (hoặc tách component nhỏ bên trong cùng file):

```typescript
function rowBackground(ti: number | null): string {
  if (ti === null || ti === 0) return "";
  return ti > 0 ? "#e6f4ea" : "#fce8e6";
}

function ValuationTable({ rows }: { rows: ValuationRow[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>STT</th>
          <th>Mã CK</th>
          <th>Giá Hiện Tại</th>
          <th>Giá Trị Nội Tại (MOS)</th>
          <th>Tỉ Suất Sinh Lời</th>
          <th>Cập Nhật Lúc</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.StockCode} style={{ backgroundColor: rowBackground(row.ti_suat_sinh_loi) }}>
            <td>{i + 1}</td>
            <td>{row.StockCode}</td>
            <td>{row.current_price !== null ? row.current_price.toFixed(2) : "—"}</td>
            <td>{row.MOS !== null ? row.MOS.toFixed(2) : "—"}</td>
            <td>
              {row.ti_suat_sinh_loi !== null
                ? `${(row.ti_suat_sinh_loi * 100).toFixed(2)}%`
                : "—"}
            </td>
            <td>{row.updated_at !== null ? new Date(row.updated_at).toLocaleString() : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Verify**: Hàng có `ti_suat_sinh_loi > 0` → nền xanh `#e6f4ea`; hàng âm → `#fce8e6`; hàng null/0 → không màu.  
`ti_suat_sinh_loi = 0.35` → hiển thị "35.00%".  
Bảng rỗng (`rows = []`) → render `<tbody>` rỗng, không crash.

---

### Step 10 — Sửa `frontend/src/App.tsx` — thêm tab state và navigator

**File**: `frontend/src/App.tsx`  
**Thay đổi**:
1. Thêm import: `import { ValuationTab } from "./components/ValuationTab";`
2. Thêm state: `const [activeTab, setActiveTab] = useState<"ranking" | "valuation">("ranking");`
3. Thêm tab buttons trước nội dung hiện tại.
4. Wrap nội dung hiện tại trong `{activeTab === "ranking" && (...)}`.
5. Thêm `{activeTab === "valuation" && <ValuationTab />}`.

```typescript
// Tab navigator (thêm sau <h1>):
<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid #ccc" }}>
  <button
    onClick={() => setActiveTab("ranking")}
    style={{
      padding: "0.5rem 1rem",
      border: "none",
      borderBottom: activeTab === "ranking" ? "2px solid #333" : "2px solid transparent",
      background: "none",
      cursor: "pointer",
      fontWeight: activeTab === "ranking" ? "bold" : "normal",
    }}
  >
    Xếp Hạng
  </button>
  <button
    onClick={() => setActiveTab("valuation")}
    style={{
      padding: "0.5rem 1rem",
      border: "none",
      borderBottom: activeTab === "valuation" ? "2px solid #333" : "2px solid transparent",
      background: "none",
      cursor: "pointer",
      fontWeight: activeTab === "valuation" ? "bold" : "normal",
    }}
  >
    Định Giá
  </button>
</div>
```

**Lưu ý**: State `selectedBank`, `selectedPeriod`, `periods` giữ nguyên ở App.tsx — không bị reset khi switch tab. Tab "Xếp Hạng" chỉ hidden (unmount), không mất state vì state ở App level.

**Lưu ý về mount/unmount**: `ValuationTab` unmount khi `activeTab !== "valuation"` → `useEffect` cleanup chạy → `controller.abort()`. Mỗi lần mount lại → useEffect chạy lại → trigger POST mới (đúng với spec AC-9).

**Verify**: 
- Load trang → tab "Xếp Hạng" active, BankList/TrendChart/RankingChart hiển thị bình thường (AC-1).
- Click "Định Giá" → tab "Xếp Hạng" ẩn, ValuationTab render (AC-2).
- Click lại "Xếp Hạng" → data hiển thị lại đúng, không bị reset (AC-8).

---

## 5. Risks

| ID | Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|----|--------|----------|-----------|-----------|
| R-1 | Cookie trong GetTradeInfo hết hạn → tất cả bank bị skip → GET trả `[]` hoặc data cũ | Cao | Cao | Refresh cookie trong `paybacktime/GetTradeInfo.ts` trước khi demo (ngoài scope impl) |
| R-2 | ~~`runPaybacktime.ts` import path vỡ~~ | — | — | **RESOLVED** — không import `runPaybacktime` (B-1 Option B) |
| R-3 | `axios` chưa có trong backend → crash khi import GetTradeInfo | Chắc chắn | Cao | Step 1 fix trước |
| R-4 | `tsc build` fail do `rootDir: "src"` | Chắc chắn | Thấp (dev không ảnh hưởng) | Step 2 hoặc document limitation |
| R-5 | ~~`saveMos` mysql2 callback~~ | — | — | **RESOLVED** — `backend/src/lib/saveMos.ts` dùng `mysql2/promise` pool |
| R-6 | Vietstock API rate-limit khi 17 bank gọi đồng thời | Thấp | Trung bình | Monitor; nếu cần throttle → Open Issue (out of scope) |
| R-7 | ~~`.env` không được load đúng~~ | — | — | **RESOLVED** — `.env` tại `backend/.env`, backend start từ `backend/` dir (B-7) |
| R-8 | `calMos` khai báo param `String` (wrapper) thay vì `string` (primitive) — TypeScript strict có thể reject | Thấp | Thấp | Nếu xảy ra: cast `code as unknown as String` tại call-site; không sửa CalMos.ts |

---

## 6. Rollback

Tất cả thay đổi là **additive** — không xóa code hiện tại, chỉ thêm:
- Backend: xóa route mount trong `index.ts` → `valuation.ts` trở thành dead file.
- Frontend: xóa `activeTab` state và tab navigator → App.tsx về trạng thái scroll ban đầu.
- `axios` dependency có thể giữ lại (không harmful).
- `tsconfig.json` change: revert về `rootDir: "src"` nếu cần.

Không có DB migration — `paybacktime` table đã tồn tại.

---

## 7. Verification Procedure

### 7.1 Backend (manual hoặc curl)

```bash
# Chạy backend (từ bank-dashboard/backend)
npm run dev

# Test 1: GET khi bảng có data
curl http://localhost:3001/api/valuation
# Expected: { "data": [...] } hoặc { "data": [] }

# Test 2: POST run
curl -X POST http://localhost:3001/api/valuation/run
# Expected: { "success": true, "skipped": [] }

# Test 3: Concurrent POST (chạy 2 cửa sổ terminal cùng lúc)
curl -X POST http://localhost:3001/api/valuation/run &
curl -X POST http://localhost:3001/api/valuation/run
# Expected: cái thứ 2 → { "success": false, "error": "concurrent_run" }, HTTP 409
```

### 7.2 Frontend (manual, browser)

1. Load `http://localhost:5173` → tab "Xếp Hạng" active (AC-1)
2. Click "Định Giá" → thấy "Đang tính toán định giá..." ngay (AC-3)
3. Đợi kết quả → bảng 6 cột xuất hiện (AC-4)
4. Kiểm tra hàng đầu có `ti_suat_sinh_loi` cao nhất (AC-5)
5. Kiểm tra format "35.00%" (AC-6)
6. Click "Xếp Hạng" → BankList/chart hiển thị đúng (AC-8)
7. Click "Định Giá" lần 2 → trigger POST mới (AC-9, xem Network tab)
8. Kiểm tra màu hàng (AC-16): hàng xanh/đỏ/mặc định

### 7.3 DB verification

```sql
-- Sau khi POST thành công (không có bank nào skip):
SELECT COUNT(*) FROM paybacktime;  -- Expected: 17

-- Kiểm tra sort ở DB level:
SELECT StockCode, ti_suat_sinh_loi FROM paybacktime ORDER BY ti_suat_sinh_loi DESC;
-- Phải khớp với thứ tự bảng trên UI
```

---

## 8. AC Mapping Table

| AC | Điều kiện | Đáp ứng tại |
|----|-----------|-------------|
| AC-1 | Tab "Xếp Hạng" active mặc định, nội dung hiện tại không mất | `App.tsx` — `useState("ranking")`, conditional render |
| AC-2 | Chỉ 1 tab content hiển thị tại một thời điểm | `App.tsx` — `activeTab === "ranking"` vs `"valuation"` |
| AC-3 | Loading text "Đang tính toán định giá..." trước khi POST xong | `ValuationTab.tsx` — initial state `{ kind: "loading" }` |
| AC-4 | Bảng 6 cột sau khi POST `{ success: true }` | `ValuationTab.tsx` → `ValuationTable` component |
| AC-5 | Thứ tự hàng giảm dần theo `ti_suat_sinh_loi` | `valuation.ts` GET → `ORDER BY ti_suat_sinh_loi DESC`; frontend render theo thứ tự nhận |
| AC-6 | Format "35.00%" cho `ti_suat_sinh_loi = 0.35` | `ValuationTable` — `(row.ti_suat_sinh_loi * 100).toFixed(2) + "%"` |
| AC-7 | HTTP 5xx → error message trong vùng lưới, không gọi GET | `ValuationTab.tsx` — catch block → `setUi({ kind: "error" })`, không gọi `fetchValuation` |
| AC-8 | Tab "Xếp Hạng" sau switch hiển thị đúng, chart không vỡ | `App.tsx` — state `selectedBank`, `selectedPeriod` giữ ở App level |
| AC-9 | Mỗi lần mount `ValuationTab` đều trigger POST mới | `ValuationTab.tsx` — `useEffect([], [])` → chạy mỗi lần mount |
| AC-10 | Per-bank `calMos` + `GetTradeInfo` + `saveMos` với logic tương đương `runPaybacktime`, upsert vào `paybacktime` | `valuation.ts` POST — inline per-bank map; `backend/src/lib/saveMos.ts` |
| AC-11 | GET trả `{ data: [...] }` với đúng fields | `valuation.ts` GET — SELECT query + `res.json({ data: rows })` |
| AC-12 | Sort theo `ti_suat_sinh_loi DESC` ở DB | `valuation.ts` GET — `ORDER BY ti_suat_sinh_loi DESC` trong SQL |
| AC-13 | POST thứ 2 → 409, frontend hiển thị concurrent message | `valuation.ts` — `isRunning` flag → 409; `ValuationTab.tsx` — `err.status === 409` → `{ kind: "concurrent" }` |
| AC-14 | 1 bank fail → skip, batch vẫn chạy, POST trả `200 { skipped: ["code"] }` | `valuation.ts` — `Promise.allSettled` per bank |
| AC-15 | POST > 10s → frontend hủy, hiển thị timeout message | `ValuationTab.tsx` — `setTimeout(abort, 10_000)` → `aborted` signal → `{ kind: "timeout" }` |
| AC-16 | Màu nền đúng theo dấu `ti_suat_sinh_loi` | `ValuationTable` — `rowBackground()` function |
