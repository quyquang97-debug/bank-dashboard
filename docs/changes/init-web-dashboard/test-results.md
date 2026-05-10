# Test Results — init-web-dashboard

**Version**: template (Phase 2 — điền vào ở Phase 6–7)  
**Date**: _____

---

## Unit Test Results

| Test Suite | Pass | Fail | Skip | Run Date | Notes |
|------------|------|------|------|----------|-------|
| detectWindow | | | | | |
| Ranking computation | | | | | |
| Period detection fallback | | | | | |
| NULL formatting (frontend) | | | | | |
| Trend label generation | | | | | |

---

## Integration Test Results

| Test ID | Description | Pass/Fail | Run Date | Notes |
|---------|-------------|-----------|----------|-------|
| IT-1 | GET /api/banks normal | | | |
| IT-2 | GET /api/banks empty DB | | | |
| IT-3 | GET /api/banks/:code/trend — annual+quarterly | | | |
| IT-4 | GET /api/banks/:code/trend — quarterly only | | | |
| IT-5 | GET /api/ranking full dataset | | | |
| IT-6 | GET /api/banks/:code/trend invalid code | | | |

---

## Black-Box Test Results

See `blackbox-testcases.md` for test case definitions.

| Test Case | Pass/Fail | Run Date | Tester | Notes |
|-----------|-----------|----------|--------|-------|
| BB-Normal-1 | | | | |
| BB-Normal-2 | | | | |
| BB-Abnormal-1 | | | | |
| BB-Abnormal-2 | | | | |
| BB-Boundary-1 | | | | |
| BB-Boundary-2 | | | | |
| BB-Boundary-3 | | | | |
| BB-Boundary-4 | | | | |
| BB-Boundary-5 | | | | |

---

## Defects Found

| ID | Severity | Description | AC | Status |
|----|----------|-------------|-----|--------|
| | | | | |

---

## Sign-off

- [ ] Unit tests: all pass
- [ ] Integration tests: all pass
- [ ] Black-box tests: all pass (or deviations documented above)
- [ ] No P0/P1 defects open

**Reviewed by**: _____  
**Date**: _____
