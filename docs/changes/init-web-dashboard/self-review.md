# Self-Review — init-web-dashboard

**Version**: 2.0 (Phase 4)  
**Supersedes**: draft-1.0 (Phase 2)

**Ngày review**: _____  
**Reviewer**: _____  
**Branch / PR**: _____

---

## 1. Commands Run

Ghi lại các lệnh đã chạy và kết quả. Điền sau implementation.

### 1.1 TypeScript compile

```
Command: cd backend && npx tsc --noEmit
Result:  [ PASS / FAIL ]
Output:
```

```
Command: cd frontend && npx tsc --noEmit
Result:  [ PASS / FAIL ]
Output:
```

### 1.2 Lint

```
Command: _______________
Result:  [ PASS / FAIL / N/A ]
Output:
```

### 1.3 Test

```
Command: _______________
Result:  [ PASS / FAIL / N/A ]
Output:
```

### 1.4 Build

```
Command: cd backend && npm run build
Result:  [ PASS / FAIL ]

Command: cd frontend && npm run build
Result:  [ PASS / FAIL ]
```

---

## 2. Golden Path (Manual Smoke Test)

Chạy `npm run dev` ở cả backend và frontend, mở `http://localhost:5173`.

- [ ] Backend khởi động không lỗi; log hiển thị `Backend running on :3001`
- [ ] Frontend khởi động không lỗi trên port 5173
- [ ] Trang load, không có lỗi đỏ trong browser console
- [ ] Bank List hiển thị đúng danh sách ngân hàng cho kỳ mới nhất
- [ ] Thứ tự ngân hàng theo `total_diem` giảm dần (ngân hàng điểm cao nhất ở đầu)
- [ ] Click vào 1 ngân hàng → Trend chart hiển thị (Chart A nếu có dữ liệu năm, Chart B nếu có dữ liệu quý)
- [ ] Toggle từng đường trong trend chart hoạt động; mặc định 5 đường đều bật
- [ ] Ranking chart hiển thị, sắp xếp từ cao xuống thấp
- [ ] Trang load xong trong < 3 giây

---

## 3. Edge Cases (Manual)

- [ ] **NULL metric** — tìm ngân hàng có ít nhất 1 chỉ số NULL: ô đó hiển thị `"—"`, không phải `"0"` hay lỗi
- [ ] **Zero value** — tìm ngân hàng có chỉ số = 0 (BID/LPB/TCB nếu chưa backfill): hiển thị `"0.00%"`, không phải `"—"`
- [ ] **Chưa chọn ngân hàng** — khu vực trend hiển thị placeholder, không blank
- [ ] **Resize 1280px** — layout không vỡ ở chiều rộng 1280px
- [ ] **Invalid trend URL** — `curl localhost:3001/api/banks/123/trend` trả 400 (không phải 500)
- [ ] **Trend 1 điểm** — nếu có ngân hàng với chỉ 1 bản ghi: chấm đơn hiển thị, không crash

---

## 4. Code Diff Review

- [ ] Không có `console.log` debug còn sót
- [ ] Không có `TODO` comment chưa được track
- [ ] Không có credential, IP, password hardcode trong source
- [ ] File `.env` không bị staged (`git status` không thấy `.env`)
- [ ] `.env.example` có đủ 6 biến: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `VITE_API_BASE_URL`
- [ ] `detectWindow` trong `backend/src/lib/detectWindow.ts` là copy verbatim từ `bank-analysis/src/scheduler.ts` lines 19–61
- [ ] Không có `import` nào từ `bank-analysis` trong `backend/`
- [ ] TypeScript strict: không có `any` không giải thích

---

## 5. AC Status

Điền sau implementation. Ghi `Done`, `Partial`, hoặc `Not done` + ghi chú nếu có deviation.

| AC | Trạng thái | Ghi chú / Deviation |
|----|-----------|---------------------|
| AC-1 (period detection + fallback) | | |
| AC-2 (6 cột trong Bank List) | | |
| AC-2b (sort by total_diem DESC) | | |
| AC-3 (empty state message) | | |
| AC-4 (NULL → "—", 0 → "0.00%") | | |
| AC-5 (2 biểu đồ riêng) | | |
| AC-6 (X axis Year / YearQQuarter) | | |
| AC-7 (5 đường toggleable) | | |
| AC-8 (ẩn biểu đồ khi không có data) | | |
| AC-9-trend (placeholder khi chưa chọn) | | |
| AC-10-rank (RANK direction + NULL handling) | | |
| AC-10 (ranking trên toàn bộ bctc_new) | | |
| AC-11 (ranking sort DESC) | | |
| AC-12 (1 bank → total_diem=4) | | |

---

## 6. Known Risks

Những rủi ro đã biết tại thời điểm submit — không cần fix ngay nhưng phải ghi nhận.

| # | Rủi ro | Khả năng | Ảnh hưởng | Trạng thái |
|---|--------|----------|-----------|------------|
| KR-1 | BID/LPB/TCB/MBB/STB có derived metrics = 0 do trigger không fire khi INSERT đầu tiên (R2 trong impl-plan) | Cao | Trung bình — hiển thị `0.00%` thay vì giá trị thực | Chờ backfill P1 |
| KR-2 | `bank-analysis/src/db.ts` chưa fix (OI-2b) — future new records vẫn INSERT với derived=0 | Cao | Trung bình | Chờ pipeline fix |
| KR-3 | LLR column type `INT NULL` (schema) — nếu trigger tính float, giá trị bị truncate trong DB | Thấp | Thấp | Known schema issue, không block |
| | | | | |

---

## 7. Not Handled Yet / Out of Scope

Những gì biết là **không** được implement trong change này (đúng theo spec-pack §2):

- [ ] Authentication / login
- [ ] Export PDF / Excel
- [ ] Mobile responsive (< 1280px)
- [ ] Alert khi chỉ số vượt ngưỡng
- [ ] Phân tích `paybacktime` / `paybacktime6year`
- [ ] Edit / nhập tay dữ liệu qua dashboard

---

## 8. Remaining Issues / Follow-up

Những vấn đề phát hiện trong quá trình implementation cần track ở backlog:

| # | Mô tả | Ưu tiên | Owner |
|---|-------|---------|-------|
| | | | |
| | | | |

---

## 9. Questions for Owner Before Merge

Liệt kê nếu có câu hỏi cần xác nhận:

- 
