# Supplement Piece Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ชิ้น` as a valid supplement content unit across the UI, API, and Neon schema.

**Architecture:** Extend the existing `ContentUnit` union and shared validation list, then update both new-table and runtime database constraints. A source-level regression test verifies all layers stay synchronized.

**Tech Stack:** React 19, TypeScript, Node test runner, Vercel Functions, Neon PostgreSQL

## Global Constraints

- Valid units are exactly `เม็ด`, `ช้อน`, `ซอง`, `ใบ`, and `ชิ้น`.
- Existing saved supplements remain unchanged.
- Neon migration runs automatically during API schema initialization.

---

### Task 1: Add a failing cross-layer unit test

**Files:**
- Create: `tests/supplement-piece-unit.test.ts`

**Interfaces:**
- Consumes the catalog component, `ContentUnit`, API validator, runtime schema, and `schema.sql` as source text.

- [ ] **Step 1: Write assertions for `ชิ้น`**

Assert the catalog contains `<option>ชิ้น</option>` and API/runtime/static schema unit lists contain `ชิ้น`.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-piece-unit.test.ts`

Expected: FAIL because `ชิ้น` is absent.

### Task 2: Implement the new unit

**Files:**
- Modify: `src/features/supplements/types.ts`
- Modify: `src/features/supplements/SupplementCatalogPanel.tsx`
- Modify: `api/_supplement-validation.ts`
- Modify: `api/_supplement-schema.ts`
- Modify: `schema.sql`

**Interfaces:**
- Extends `ContentUnit` with `'ชิ้น'`.
- `parseSupplementInput` accepts `contentUnit: 'ชิ้น'`.

- [ ] **Step 1: Add `ชิ้น` to TypeScript, UI, and API**

Extend the union, append the dropdown option, and append `ชิ้น` to the API unit set.

- [ ] **Step 2: Update database constraints**

Include `ชิ้น` in `CREATE TABLE` and in the runtime/static drop-and-recreate migration for `supplements_content_unit_check`.

- [ ] **Step 3: Run and verify GREEN**

Run: `node --experimental-strip-types --test tests/supplement-piece-unit.test.ts`

Expected: PASS.

### Task 3: Verify and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-supplement-piece-unit.md`

- [ ] **Step 1: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Check API and production build**

Run: `npx tsc --ignoreConfig --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext --target es2023 --types node api/*.ts api/_*.ts`

Run: `npm run build`

Expected: both exit successfully; the existing large-chunk warning is acceptable.

- [ ] **Step 3: Commit and push main**

```bash
git add src/features/supplements/types.ts src/features/supplements/SupplementCatalogPanel.tsx api/_supplement-validation.ts api/_supplement-schema.ts schema.sql tests/supplement-piece-unit.test.ts docs/superpowers/plans/2026-07-23-supplement-piece-unit.md
git commit -m "feat: add supplement piece unit"
git push origin main
```
