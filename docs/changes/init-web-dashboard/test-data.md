# Test Data — init-web-dashboard

**Version**: draft-1.0 (Phase 2)  
**Date**: 2026-05-08

---

## 1. Seed Scripts

### DS-1: Normal — 5 banks, Q4/2024 (Normal-1 từ spec §8.1)

```sql
-- Xóa dữ liệu test trước nếu cần
DELETE FROM finance.bctc_new WHERE Year = 2024 AND Quarter = 4 AND StockCode IN ('VCB','TCB','BID','MBB','ACB');

INSERT INTO finance.bctc_new
  (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu,
   TrichLuyDuPhong, TongChoVay, TongTienGui, DoanhThuNamNgoai, DoanhThuNamNay,
   NoCoKhaNangMatVon, NoNghiNgo, NoDuoiTieuChuan)
VALUES
  ('VCB', 2024, 4, 1.20, 180, 78.3, 12.5,  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('TCB', 2024, 4, 2.10, 95,  82.1,  8.3,  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('BID', 2024, 4, 1.85, 110, 85.5,  5.1,  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('MBB', 2024, 4, 1.60, 140, 76.0, 15.2,  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('ACB', 2024, 4, 1.30, 130, 88.0, 10.0,  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
```

> Note: LLR schema is INT — values like 180.5 will be truncated to 180. This is a known schema issue (LLR should be DOUBLE/FLOAT). Track in report.md.

---

### DS-2: VCB trend data — annual + quarterly

```sql
-- Annual (Quarter=0)
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu)
VALUES
  ('VCB', 2022, 0, 1.10, 170, 75.0, 8.0),
  ('VCB', 2023, 0, 1.15, 175, 76.5, 10.0),
  ('VCB', 2024, 0, 1.20, 180, 78.3, 12.5);

-- Quarterly (Quarter=1-4, 2023-2024)
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu)
VALUES
  ('VCB', 2023, 1, 1.08, 168, 74.0, 7.5),
  ('VCB', 2023, 2, 1.09, 170, 74.5, 8.5),
  ('VCB', 2023, 3, 1.12, 172, 75.5, 9.0),
  ('VCB', 2023, 4, 1.15, 175, 76.5, 10.0),
  ('VCB', 2024, 1, 1.16, 176, 77.0, 11.0),
  ('VCB', 2024, 2, 1.18, 178, 77.5, 11.5),
  ('VCB', 2024, 3, 1.19, 179, 78.0, 12.0),
  ('VCB', 2024, 4, 1.20, 180, 78.3, 12.5);
```

---

### DS-3: NULL metric (Abnormal-2)

```sql
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu)
VALUES ('TCB', 2024, 4, NULL, 95, 82.1, 8.3)
ON DUPLICATE KEY UPDATE NPL = NULL;
```

---

### DS-4: Single bank (Boundary-1)

```sql
DELETE FROM finance.bctc_new;  -- CAUTION: clears all data — use test DB only
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu)
VALUES ('VCB', 2025, 1, 1.20, 180, 78.3, 12.5);
```

---

### DS-5: TangTruongDoanhThu = 0 (Boundary-2)

```sql
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu,
  DoanhThuNamNgoai, DoanhThuNamNay)
VALUES ('STB', 2024, 4, 1.50, 120, 80.0, 0.00, 500000, 500000);
```

---

### DS-6: Single data point trend (Boundary-3)

```sql
INSERT INTO finance.bctc_new (StockCode, Year, Quarter, NPL, LLR, LDR, TangTruongDoanhThu)
VALUES ('LPB', 2024, 0, 0.74, 90, 110.0, 5.0);
-- No Quarter=1-4 for LPB in this seed
```

---

## 2. Teardown

```sql
-- Xóa tất cả seed data test sau khi test xong
DELETE FROM finance.bctc_new 
WHERE StockCode IN ('VCB','TCB','BID','MBB','ACB','STB','LPB')
  AND Year IN (2022, 2023, 2024, 2025);
```

---

## 2. Known Data Quality in Production DB (2026-05-08)

| Bank | Issue | Expected vs Actual |
|------|-------|--------------------|
| BID | M2 — first INSERT had derived=0 | LDR nên là ~113.5% nhưng = 0 |
| LPB | M2 | NPL nên là ~0.74% nhưng = 0 |
| TCB | M2 | LLR nên là ~154% nhưng = 0 |
| CTG | OK | Đã crawl ≥ 2 lần, trigger đã kích hoạt |
| VCB | OK | |
| VPB | OK | |

Backfill cần chạy trước khi demo production data.
