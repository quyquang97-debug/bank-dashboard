Viết Software Design Document (SDD) cho tính năng "Sàng Lọc Cổ Phiếu" 
trong hệ thống Bank Dashboard hiện có. Sau đây là toàn bộ context kỹ thuật:

---

## 1. Hệ thống hiện tại

**Stack:**
- Frontend: React + TypeScript + Vite (port 5173)
- Backend: Node.js + Express + TypeScript (port 3001)
- Database: MySQL

**Cấu trúc thư mục backend:**
backend/src/
  index.ts          ← entry point, đăng ký router
  routes/
    banks.ts
    ranking.ts
    periods.ts
    valuation.ts

**Cấu trúc thư mục frontend:**
frontend/src/
  App.tsx           ← tab navigator ("ranking" | "valuation")
  api/client.ts     ← tất cả fetch calls
  components/
    BankList.tsx
    RankingChart.tsx
    TrendChart.tsx
    PeriodFilter.tsx
    ValuationTab.tsx

**Các API đang có:**
- GET  /api/ranking/history  → { data: [{ year, quarter, stockCode, totalDiem }] }
- GET  /api/valuation        → { data: [{ StockCode, MOS, current_price, ti_suat_sinh_loi, updated_at }] }
- POST /api/valuation/run    → chạy lại tính toán định giá

---

## 2. Tính năng cần thiết kế

**Tên tính năng:** Sàng Lọc Cổ Phiếu

**Mô tả:** Tự động tổng hợp dữ liệu từ 2 nguồn (ranking + valuation), 
tính điểm tổng hợp cho từng mã cổ phiếu, đưa ra tín hiệu khuyến nghị 
(MUA / GIỮ / TRÁNH).

**Vị trí hiển thị:** Thêm tab thứ 3 "🎯 Sàng Lọc" vào navigator trong App.tsx, 
song song với tab "Xếp Hạng" và "Định Giá" hiện có.

---

## 3. Công thức tính điểm Sàng Lọc

Người dùng chọn một kỳ (Quý hoặc Năm) qua combobox ở đầu tab.
Toàn bộ phép tính bên dưới được thực hiện trên tập mã của kỳ được chọn.

Đầu vào cho mỗi mã cổ phiếu i (tại kỳ được chọn):
  - totalDiem_i   : tổng điểm xếp hạng tại kỳ được chọn (từ /api/ranking/history,
                    filter theo year + quarter người dùng chọn)
  - ti_i          : ti_suat_sinh_loi (từ /api/valuation), 
                    = (MOS - current_price) / current_price
                    (lưu ý: valuation hiện chỉ có snapshot mới nhất, không theo kỳ —
                     phase này chấp nhận dùng giá trị hiện tại bất kể kỳ được chọn)

Bước 1 — Chuẩn hoá điểm Xếp Hạng:
  S_rank(i) = (totalDiem_i - min_all) / (max_all - min_all) × 100

Bước 2 — Chuẩn hoá điểm Định Giá:
  ti_capped(i) = clamp(ti_i, -0.5, +0.5)
  S_val(i)     = (ti_capped_i + 0.5) / 1.0 × 100

Bước 3 — Điểm tổng hợp:
  Score(i) = 0.5 × S_rank(i) + 0.5 × S_val(i)

Bước 4 — Tín hiệu khuyến nghị:
  Score ≥ 65       → MUA
  40 ≤ Score < 65  → GIỮ
  Score < 40       → TRÁNH

---

## 4. Yêu cầu thiết kế

**Backend:**
- Thêm route mới: GET /api/screening?year={int}&quarter={int}
  - quarter = 0 nghĩa là cả năm (cùng convention với /api/periods hiện có)
  - year + quarter là bắt buộc; nếu thiếu/sai → 400
- Route này gọi nội bộ dữ liệu từ ranking history (filter theo year+quarter)
  và valuation (snapshot hiện tại), thực hiện tính toán điểm tổng hợp cho
  tất cả mã thuộc kỳ được chọn, trả về JSON:
  {
    period: { year: number, quarter: number },  // echo lại kỳ được chọn
    data: [
      {
        stockCode: string,
        s_rank: number,            // 0-100
        s_val: number,             // 0-100
        score: number,             // 0-100
        signal: "MUA" | "GIỮ" | "TRÁNH",
        totalDiem: number,         // raw, tại kỳ được chọn
        ti_suat_sinh_loi: number | null,  // raw
        current_price: number | null,
        MOS: number | null
      }
    ],
    computed_at: string            // ISO timestamp
  }
- Tạo file: backend/src/routes/screening.ts
- Đăng ký router trong index.ts: app.use("/api/screening", screeningRouter)

**Frontend:**
- Thêm hàm fetchScreening(year, quarter) vào frontend/src/api/client.ts
- Tạo component: frontend/src/components/ScreeningTab.tsx
  Hiển thị:
  (a) Combobox chọn kỳ (Quý hoặc Năm) ở đầu tab,
      tái sử dụng <PeriodFilter /> hiện có và fetchPeriods() từ /api/periods.
      - Mặc định chọn kỳ mới nhất khi mới mở tab
      - Khi đổi kỳ → fetch lại /api/screening và render lại bảng
  (b) Bảng đầy đủ tất cả mã thuộc kỳ được chọn, sắp xếp theo Score giảm dần,
      gồm các cột: Mã CK | Điểm XH | Điểm Định Giá | Điểm Tổng Hợp | Tín hiệu
  (c) Chú thích công thức ngắn gọn ở cuối trang
- Cập nhật App.tsx: thêm tab "🎯 Sàng Lọc" vào navigator,
  thêm state activeTab có thể nhận giá trị "screening",
  render <ScreeningTab /> khi tab được chọn

**Không thay đổi:**
- Không sửa logic của tab Xếp Hạng và Định Giá hiện có
- Không thêm database table mới (tính toán in-memory)
- Không dùng external AI/LLM API trong phase này