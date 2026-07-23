# Supplement Cashback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ใบ` as a content unit and persist/display cashback calculated from the course final net total.

**Architecture:** Extend the shared pricing module with a pure cashback function used by both React and the Vercel API. Add backward-compatible Neon columns and update the existing unit constraint during runtime schema initialization.

**Tech Stack:** TypeScript 6, Node test runner, React 19, Neon PostgreSQL, jsPDF/html2canvas.

---

### Task 1: Cashback Pricing Tests

**Files:**
- Modify: `tests/supplement-pricing.test.ts`
- Modify: `src/features/supplements/pricing.ts`

- [ ] Add failing tests for 6% of ฿2,900, decimal rounding, and unchanged final total.
- [ ] Implement `calculateCashback(total, percent)` using satang-safe rounding.

### Task 2: Schema, Types, and Catalog Unit

**Files:**
- Modify: `schema.sql`
- Modify: `api/_supplement-schema.ts`
- Modify: `api/_supplements-handler.ts`
- Modify: `src/features/supplements/types.ts`
- Modify: `src/features/supplements/SupplementCatalogPanel.tsx`

- [ ] Add `ใบ` to type/UI/API/Neon constraints.
- [ ] Add cashback columns with defaults to create and runtime alter paths.
- [ ] Extend saved course contract with cashback fields.

### Task 3: Authoritative Cashback Save

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `src/features/supplements/SupplementCourseForm.tsx`

- [ ] Add course-level percentage state/dropdown and live amount.
- [ ] Send `cashbackPercent` in the create payload.
- [ ] Validate allowed percentages, calculate from authoritative final total, and insert both snapshot fields.

### Task 4: History and PDF

**Files:**
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `src/features/supplements/coursePdf.ts`

- [ ] Show saved cashback on history cards and detail totals.
- [ ] Add saved cashback percentage and amount to PDF totals.

### Task 5: Verification and Commit

- [ ] Run all supplement tests and API TypeScript check.
- [ ] Run production build.
- [ ] Review and commit approved files on `main`.
