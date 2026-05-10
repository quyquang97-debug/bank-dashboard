# Test Plan — init-web-dashboard

**Version**: draft-1.0 (Phase 2)  
**Date**: 2026-05-08

---

## 1. Test Strategy

| Layer | Test Type | Tool (proposed) | When to run |
|-------|-----------|-----------------|-------------|
| API business logic | Unit Test (UT) | Vitest or Jest | Per commit |
| API + DB | Integration Test (IT) | Vitest + real dev DB | Pre-merge |
| UI render | Unit Test (UT) | Vitest + React Testing Library | Per commit |
| Full flow | End-to-End (E2E) | Playwright (optional for now) | Pre-release |
| Edge cases / boundary | Black-Box (BB) | Manual or Playwright | Pre-merge |

No mock DB for integration tests — use real dev DB with known seed data (see `test-data.md`).

---

## 2. Coverage Targets (Phase 3 onward)

- API routes: 100% of happy path + all explicitly listed error cases
- Ranking computation: 100% (core business logic)
- `detectWindow`: reuse existing tests from `bank-analysis/test/scheduler.test.ts` — do NOT rewrite

---

## 3. Unit Tests — API

### UT-1: detectWindow (copy from bank-analysis)
- Verify copied function returns same results as original for all month/day combinations in `scheduler.test.ts`.

### UT-2: Ranking computation
- Given 5 banks with known NPL/LLR/LDR/TangTruongDoanhThu values → assert correct RANK values and total_diem.
- Given 1 bank → assert all ranks = 1, total_diem = 4.
- Given bank with NULL NPL → assert NPL_diem = null, other metrics ranked normally.

### UT-3: Period detection fallback
- When `detectWindow` returns null AND DB has records → fallback returns correct `(year, quarter)` from MAX.
- When `detectWindow` returns null AND DB is empty → returns empty list.

### UT-4: NULL → "—" formatting (frontend)
- Given `null` value → `formatMetric(null)` returns `"—"`.
- Given `0` → returns `"0.00%"`.
- Given `1.234` → returns `"1.23%"`.

### UT-5: Trend label generation
- `Quarter=0, Year=2024` → label `"2024"`.
- `Quarter=1, Year=2024` → label `"2024Q1"`.
- `Quarter=4, Year=2023` → label `"2023Q4"`.

---

## 4. Integration Tests — API + DB

### IT-1: GET /api/banks — normal
- Seed: 5 banks in kỳ Q4/2024 (Normal-1 data from spec §8.1).
- `detectWindow` will return null (date is May 2026) → fallback to MAX.
- Assert: 5 banks returned, sorted by total_diem DESC, correct values.

### IT-2: GET /api/banks — empty DB
- Seed: empty bctc_new.
- Assert: `{ data: [], meta: { period: null } }`, HTTP 200.

### IT-3: GET /api/banks/:code/trend — VCB with both annual and quarterly data
- Seed: VCB with Quarter=0 (2022–2024) and Quarter=1–4 (2023–2024).
- Assert: `annual.length=3`, `quarterly.length=8`, labels correct.

### IT-4: GET /api/banks/:code/trend — bank with only quarterly data
- Seed: bank with no Quarter=0 records.
- Assert: `annual=[]`, `quarterly.length > 0`.

### IT-5: GET /api/ranking — full dataset
- Seed: 5 banks.
- Assert: RANK values correct per cal_diem.sql logic, sorted by total_diem DESC.

### IT-6: GET /api/banks/:code/trend — invalid code
- Request: `/api/banks/INVALID_CODE/trend`
- Assert: HTTP 400 or 404 with error body.

---

## 5. Black-Box / Boundary Tests

See `blackbox-testcases.md` for full list. Key cases:

- Abnormal-1: DB empty → all 3 sections show empty state
- Abnormal-2: Bank with NULL NPL → "—" in table, excluded from NPL rank
- Boundary-1: 1 bank → total_diem = 4
- Boundary-2: TangTruongDoanhThu = 0 → displays "0.00%", no error
- Boundary-3: 1 data point in trend → single dot, no crash

---

## 6. Not Tested in This Ticket

- Authentication (none required — NFR-3)
- Mobile/responsive below 1280px (out of scope)
- PDF export (out of scope)
- Performance / load testing (no SLA defined — NFR-1 is informal)
