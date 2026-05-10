# Report — init-web-dashboard

**Version**: draft-1.0 (Phase 2)  
**Date**: 2026-05-08  
**Status**: In Progress

---

## Phase Progress

| Phase | Name | Status | Date completed |
|-------|------|--------|----------------|
| 0-A | Gather raw sources | Done | — |
| 0-B | Common base setup | Done | — |
| 1 | Spec Pack | Done | 2026-05-08 |
| 2 | Architecture context + initial docs | Done | 2026-05-08 |
| 3 | Backend scaffolding + DB layer | Pending | |
| 4 | API endpoints | Pending | |
| 5 | Frontend components | Pending | |
| 6 | Integration + edge cases | Pending | |
| 7 | Tests | Pending | |
| 8 | Review + handoff | Pending | |

---

## Decisions Made in Phase 2

| # | Decision | Rationale |
|---|----------|-----------|
| D-1 | `detectWindow` copied (not imported) from bank-analysis | Avoid monorepo dependency; pure function, no side effects |
| D-2 | Recharts for charting | Best React integration; handles null points natively |
| D-3 | mysql2/promise pool (not per-request connection) | db.ts original used single connection — upgrade to pool for robustness |
| D-4 | total_diem in trend chart uses global RANK (same as ranking endpoint) | Spec says RANK over full bctc_new — consistent with AC-10 |

---

## Gaps & Cautions for Phases 3–8

### Critical (must resolve before implementation)

- **GAP-1 — LLR RANK direction mismatch**: `cal_diem.sql` has `ORDER BY LLR` (ASC) which would give RANK=1 to the *lowest* LLR. But spec says "LLR cao hơn → điểm cao hơn → tốt hơn" — this implies RANK should favor higher LLR (i.e., use `ORDER BY LLR DESC`). **Must confirm with owner before writing the API query.**

- **GAP-2 — LLR schema is INT**: `create_table.sql` defines `LLR INT NULL`. Formula output (e.g., 180.5%) gets truncated to 180. This affects ranking precision. Options: (a) ALTER TABLE to change LLR to DOUBLE, or (b) accept precision loss. **Needs decision before data backfill.**

- **GAP-3 — M2 backfill prerequisite**: BID, LPB, TCB (and possibly others) have derived metrics = 0 due to first-INSERT trigger issue. Dashboard will show wrong data until backfill runs. **Must run backfill (UPDATE trick) and fix db.ts before production demo.**

### Important (handle during implementation)

- **CAUTION-1 — MySQL RANK() with NULLs**: MySQL 8 RANK() OVER with NULLs in ORDER BY may place NULLs first or last depending on `NULLS FIRST/LAST` (MySQL 8.0.30+). Verify behavior with actual DB version and adjust SQL accordingly.

- **CAUTION-2 — total_diem in trend chart**: Spec §5.2 says trend chart shows `total_diem` as one of the 5 lines. But `total_diem` from the ranking endpoint is computed over the *full* table (all periods). In trend context, showing the "global total_diem" per period is misleading. Consider computing per-period rank instead, or clarifying with owner. Tracked as OQ-1 in impl-plan.md.

- **CAUTION-3 — `detectWindow` today is null**: Current date (2026-05-08 = May 8) falls in May — outside all crawl windows (Jan, Mar, Apr, Jul, Oct). So `detectWindow` returns null, and Bank List will use MAX fallback. This is correct behavior, but ensure the fallback is tested.

- **CAUTION-4 — No UI mockup**: Layout decisions (column order, chart colors, positioning) must be made by implementer. Document any non-obvious layout choices in self-review.md.

- **CAUTION-5 — Seed data LLR precision**: DS-1 seed uses 180.5 for LLR but schema is INT — will be stored as 180. Test assertions must match DB-stored value, not seed value.

### Low priority

- **NOTE-1 — `db.ts` has commented-out convertToInt calls**: `TongChoVay`, `TongTienGui`, etc. are passed as-is (string or number). This may cause silent type issues if raw extracted values are strings. Dashboard API reads from DB (already stored), so not a dashboard concern — but affects backfill correctness.

- **NOTE-2 — No `.env.example` yet**: Create before first commit.

- **NOTE-3 — No `created_at`/`updated_at` in migration**: Migration `refactor-004-add-created-at.sql` adds these fields. Ensure dev DB has run this migration.

---

## Risks Carried Forward

From spec-pack §10:

| Risk | Current status |
|------|----------------|
| R1 — NPL/LLR/LDR = 0 for some banks | Active — backfill (P1/P2) required before demo |
| R2 — Ranking mixes periods (cal_diem design) | Accepted — by design per OI-3 CLOSED |
| R3 — No seed/mock data for UI dev | Partially mitigated — test-data.md has seed scripts |
| R4 — NULL causes chart crash | Mitigated — use `connectNulls={false}` in Recharts |

---

## Change Log

| Date | Phase | Author | Summary |
|------|-------|--------|---------|
| 2026-05-08 | Phase 1 | | spec-pack.md v1.1 finalized |
| 2026-05-08 | Phase 2 | | Architecture docs + initial working files created |
