# Yêu cầu: Thêm đa ngôn ngữ (Tiếng Anh & Tiếng Nhật)

## Bối cảnh

Đây là dashboard phân tích tài chính ngân hàng Việt Nam, xây dựng bằng React + TypeScript (Vite).
Toàn bộ giao diện hiện đang hardcode tiếng Việt. Mục tiêu là thêm Tiếng Anh (en) và Tiếng Nhật (ja)
làm ngôn ngữ có thể chọn bên cạnh Tiếng Việt (vi), với nút chuyển ngôn ngữ đặt trên header.

**Các file liên quan:**

- `frontend/src/App.tsx` — shell chính, header, tabs
- `frontend/src/components/BankList.tsx` — bảng xếp hạng
- `frontend/src/components/ScreeningTab.tsx` — tín hiệu sàng lọc (MUA / GIỮ / TRÁNH)
- `frontend/src/components/ValuationTab.tsx` — bảng định giá + nút chạy lại
- `frontend/src/components/PeriodFilter.tsx` — dropdown chọn kỳ
- `frontend/src/components/RankingChart.tsx` — biểu đồ xếp hạng
- `frontend/src/components/TrendChart.tsx` — biểu đồ xu hướng

---

## Yêu cầu chi tiết

### 1. Thư viện

Dùng **react-i18next** + **i18next**. Cài đặt:

```
npm install i18next react-i18next
```

Không cần backend plugin — load bản dịch từ file JSON tĩnh đóng gói cùng app.

---

### 2. Các file ngôn ngữ

Tạo `frontend/src/locales/vi.json`, `frontend/src/locales/en.json`, `frontend/src/locales/ja.json`.

Ba file phải dùng chung bộ key giống hệt nhau. Nội dung từng file như sau:

#### `frontend/src/locales/vi.json`
```json
{
  "brand_subtitle": "Phân Tích Tài Chính",
  "brand_title": "Ngân Hàng Việt Nam",
  "tab_ranking": "Xếp Hạng",
  "tab_valuation": "Định Giá",
  "tab_screening": "Sàng Lọc",
  "section_bank_list": "Danh Sách Ngân Hàng",
  "section_trend": "Xu Hướng",
  "section_ranking": "Xếp Hạng Ngân Hàng",
  "section_valuation": "Định Giá Cổ Phiếu",
  "col_bank": "Ngân Hàng",
  "col_npl": "NPL (%)",
  "col_llr": "LLR (%)",
  "col_ldr": "LDR (%)",
  "col_growth": "Tăng Trưởng (%)",
  "col_total_score": "Điểm Tổng",
  "col_no": "STT",
  "col_stock_code": "Mã CK",
  "col_rank_score": "Điểm XH",
  "col_val_score": "Điểm Định Giá",
  "col_score": "Score",
  "col_price": "Giá Hiện Tại",
  "col_mos": "MOS",
  "col_return": "TSSL",
  "col_signal": "Tín Hiệu",
  "col_intrinsic": "Giá Trị Nội Tại (MOS)",
  "col_return_rate": "Tỉ Suất Sinh Lời",
  "col_updated": "Cập Nhật Lúc",
  "signal_buy": "MUA",
  "signal_hold": "GIỮ",
  "signal_avoid": "TRÁNH",
  "card_buy": "CỔ PHIẾU MUA",
  "card_hold": "CỔ PHIẾU GIỮ",
  "card_avoid": "CỔ PHIẾU TRÁNH",
  "btn_revalue": "Thực hiện định giá lại",
  "btn_revalue_running": "Đang tính toán...",
  "msg_revalue_done": "Định giá hoàn tất.",
  "msg_revalue_error": "Lỗi tính toán, vui lòng thử lại.",
  "loading": "Đang tải…",
  "loading_data": "Đang tải dữ liệu...",
  "loading_calculating": "Đang tính toán...",
  "error_load": "Lỗi tải dữ liệu",
  "error_load_retry": "Lỗi tải dữ liệu, vui lòng thử lại.",
  "no_data_period": "Không có dữ liệu cho kỳ này",
  "no_data": "Không có dữ liệu",
  "period_annual": "{{year}} (Năm)",
  "period_quarter": "Q{{quarter}}/{{year}}",
  "screening_formula": "Score = 0.5 × Điểm XH + 0.5 × Điểm Định Giá (chuẩn hoá 0–100). Tín hiệu: Score ≥ 65 → MUA · 40–65 → GIỮ · < 40 → TRÁNH"
}
```

#### `frontend/src/locales/en.json`
```json
{
  "brand_subtitle": "Financial Analysis",
  "brand_title": "Vietnam Banks",
  "tab_ranking": "Ranking",
  "tab_valuation": "Valuation",
  "tab_screening": "Screening",
  "section_bank_list": "Bank List",
  "section_trend": "Trend",
  "section_ranking": "Bank Ranking",
  "section_valuation": "Stock Valuation",
  "col_bank": "Bank",
  "col_npl": "NPL (%)",
  "col_llr": "LLR (%)",
  "col_ldr": "LDR (%)",
  "col_growth": "Revenue Growth (%)",
  "col_total_score": "Total Score",
  "col_no": "No.",
  "col_stock_code": "Ticker",
  "col_rank_score": "Rank Score",
  "col_val_score": "Valuation Score",
  "col_score": "Score",
  "col_price": "Current Price",
  "col_mos": "MOS",
  "col_return": "Return",
  "col_signal": "Signal",
  "col_intrinsic": "Intrinsic Value (MOS)",
  "col_return_rate": "Return Rate",
  "col_updated": "Updated At",
  "signal_buy": "BUY",
  "signal_hold": "HOLD",
  "signal_avoid": "AVOID",
  "card_buy": "BUY",
  "card_hold": "HOLD",
  "card_avoid": "AVOID",
  "btn_revalue": "Run Revaluation",
  "btn_revalue_running": "Calculating...",
  "msg_revalue_done": "Valuation complete.",
  "msg_revalue_error": "Calculation error, please try again.",
  "loading": "Loading…",
  "loading_data": "Loading data...",
  "loading_calculating": "Calculating...",
  "error_load": "Failed to load data",
  "error_load_retry": "Failed to load data, please try again.",
  "no_data_period": "No data for this period",
  "no_data": "No data",
  "period_annual": "{{year}} (Annual)",
  "period_quarter": "Q{{quarter}}/{{year}}",
  "screening_formula": "Score = 0.5 × Rank Score + 0.5 × Valuation Score (normalised 0–100). Signal: Score ≥ 65 → BUY · 40–65 → HOLD · < 40 → AVOID"
}
```

#### `frontend/src/locales/ja.json`
```json
{
  "brand_subtitle": "財務分析",
  "brand_title": "ベトナム銀行",
  "tab_ranking": "ランキング",
  "tab_valuation": "バリュエーション",
  "tab_screening": "スクリーニング",
  "section_bank_list": "銀行リスト",
  "section_trend": "トレンド",
  "section_ranking": "銀行ランキング",
  "section_valuation": "株式バリュエーション",
  "col_bank": "銀行",
  "col_npl": "NPL (%)",
  "col_llr": "LLR (%)",
  "col_ldr": "LDR (%)",
  "col_growth": "収益成長率 (%)",
  "col_total_score": "総合スコア",
  "col_no": "No.",
  "col_stock_code": "銘柄",
  "col_rank_score": "ランクスコア",
  "col_val_score": "バリュエーションスコア",
  "col_score": "スコア",
  "col_price": "現在価格",
  "col_mos": "MOS",
  "col_return": "リターン",
  "col_signal": "シグナル",
  "col_intrinsic": "本質的価値 (MOS)",
  "col_return_rate": "収益率",
  "col_updated": "更新日時",
  "signal_buy": "買い",
  "signal_hold": "保有",
  "signal_avoid": "回避",
  "card_buy": "買い推奨",
  "card_hold": "保有推奨",
  "card_avoid": "回避推奨",
  "btn_revalue": "再バリュエーション実行",
  "btn_revalue_running": "計算中...",
  "msg_revalue_done": "バリュエーション完了。",
  "msg_revalue_error": "計算エラー。再試行してください。",
  "loading": "読み込み中…",
  "loading_data": "データを読み込み中...",
  "loading_calculating": "計算中...",
  "error_load": "データの読み込みに失敗しました",
  "error_load_retry": "データの読み込みに失敗しました。再試行してください。",
  "no_data_period": "この期間のデータがありません",
  "no_data": "データなし",
  "period_annual": "{{year}}年（通年）",
  "period_quarter": "{{year}}年Q{{quarter}}",
  "screening_formula": "スコア = 0.5 × ランクスコア + 0.5 × バリュエーションスコア（0〜100に正規化）。シグナル: スコア ≥ 65 → 買い · 40〜65 → 保有 · < 40 → 回避"
}
```

---

### 3. Khởi tạo i18n

Tạo file `frontend/src/i18n.ts`:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en }, ja: { translation: ja } },
  lng: localStorage.getItem("lang") ?? "vi",
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
});

export default i18n;
```

Import một lần duy nhất ở đầu `frontend/src/main.tsx` (trước khi React render):

```ts
import "./i18n";
```

---

### 4. Component chuyển ngôn ngữ

Tạo `frontend/src/components/LangSwitcher.tsx`:

```tsx
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "vi", label: "VI" },
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
] as const;

export function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  function change(code: string) {
    i18n.changeLanguage(code);
    localStorage.setItem("lang", code);
  }

  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "auto", padding: "0 1rem" }}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => change(code)}
          style={{
            padding: "4px 10px",
            fontSize: "0.72rem",
            fontWeight: current === code ? 700 : 400,
            background: current === code ? "rgba(245,200,66,0.15)" : "transparent",
            border: current === code ? "1px solid rgba(245,200,66,0.45)" : "1px solid rgba(255,255,255,0.12)",
            color: current === code ? "#f5c842" : "rgba(200,215,255,0.55)",
            borderRadius: "6px",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

---

### 5. Thay đổi trong từng component

Thay toàn bộ chuỗi tiếng Việt hardcode bằng hook `useTranslation`.

**App.tsx**

- Import `useTranslation` và `LangSwitcher`.
- `"Phân Tích Tài Chính"` → `t("brand_subtitle")`
- `"Ngân Hàng Việt Nam"` → `t("brand_title")`
- Nhãn tab thay bằng `t("tab_ranking")`, `t("tab_valuation")`, `t("tab_screening")` (giữ nguyên emoji).
- Các tiêu đề section thay bằng `t(...)` tương ứng.
- Thêm `<LangSwitcher />` vào trong flex container của header, đặt sau div chứa các tab.

**BankList.tsx**

- Import `useTranslation`, gọi `const { t } = useTranslation();` trong component.
- Thay các chuỗi trạng thái (`"Đang tải…"`, `"Lỗi tải dữ liệu"`, `"Không có dữ liệu cho kỳ này"`) bằng `t(...)`.
- Thay toàn bộ nội dung `<th>` bằng `t(...)`.

**ScreeningTab.tsx**

- `SIGNAL_CONFIG` đang chứa nhãn tiếng Việt. Đổi field `label` thành translation key (ví dụ `"signal_buy"`) và render bằng `t(cfg.labelKey)` trong JSX. Làm tương tự cho subtitle card (`"card_buy"` v.v.).
- Thay các chuỗi trạng thái và tiêu đề `<th>` bằng `t(...)`.
- Thay đoạn chú thích công thức bằng `t("screening_formula")`.

**ValuationTab.tsx**

- Thay toàn bộ text nút, thông báo trạng thái và tiêu đề `<th>` bằng `t(...)`.

**PeriodFilter.tsx**

- Thay `"Không có dữ liệu"` bằng `t("no_data")`.
- Sửa hàm `periodLabel` để dùng `t("period_annual", { year })` và `t("period_quarter", { quarter, year })`. Vì đây là hàm thường (không phải component), hãy truyền `t` vào làm tham số hoặc chuyển `PeriodFilter` sang dùng hook trực tiếp bên trong component.

---

### 6. Ràng buộc

- **Không** thay đổi bất kỳ API call, data model, giá trị style hay logic nghiệp vụ nào.
- **Không** dịch các giá trị đến từ backend (ví dụ: `stockCode`, các trường số).
- Các giá trị tín hiệu backend (`MUA`, `GIỮ`, `TRÁNH`) vẫn dùng làm key trong `SIGNAL_CONFIG` và đối chiếu với `row.signal`. Chỉ dịch phần nhãn hiển thị.
- Lưu ngôn ngữ đã chọn vào `localStorage` với key `"lang"` để giữ lựa chọn sau khi refresh trang.
- TypeScript phải không có lỗi sau khi thay đổi.

---

## Tiêu chí hoàn thành

- [ ] Ba file locale JSON đã được tạo với đầy đủ các key.
- [ ] `i18n.ts` đã khởi tạo và được import trong `main.tsx`.
- [ ] `LangSwitcher` hiển thị trên header.
- [ ] Năm component đã dùng `t(...)` cho mọi chuỗi hiển thị với người dùng.
- [ ] Chuyển ngôn ngữ trên UI lập tức re-render toàn bộ text mà không cần reload trang.
- [ ] `npm run build` (trong thư mục `frontend/`) hoàn thành không có lỗi TypeScript.
