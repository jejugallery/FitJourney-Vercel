# Shared Supplement Product Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use one stable application-first, paid-middle, free-last alphabetical ordering rule on every product surface.

**Architecture:** Replace the PDF-specific sorter with a generic immutable ordering helper that accepts name and price selector functions. Each UI derives an ordered display array while keeping its source state unchanged.

**Tech Stack:** React 19, TypeScript, Node test runner

## Global Constraints

- Free application products remain in the first group.
- Thai locale name ordering applies inside each group.
- Equal-name products retain their original relative order.
- Sorting must not mutate source arrays or alter calculations.

---

### Task 1: Generic stable product ordering

**Files:**
- Create: `src/features/supplements/productOrder.ts`
- Modify: `tests/supplement-pdf-order.test.ts`
- Delete: `src/features/supplements/pdfItemOrder.ts`

**Interfaces:**
- Produces: `orderSupplementProducts<T>(items: T[], getName: (item: T) => string, getUnitPrice: (item: T) => number): T[]`.

- [ ] **Step 1: Write failing generic ordering tests**

Test all three groups, Thai alphabetical order, free-application precedence, stable equal names, and source immutability.

- [ ] **Step 2: Run and verify RED**

Run the ordering test and expect failure because the generic helper does not exist.

- [ ] **Step 3: Implement the helper**

Decorate with original index, sort by group rank, Thai `localeCompare`, then original index, and return a new array.

- [ ] **Step 4: Run and verify GREEN**

Run ordering tests and expect all cases to pass.

### Task 2: Catalog, picker, and selected draft lines

**Files:**
- Modify: `src/features/supplements/SupplementCatalogPanel.tsx`
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Create: `tests/supplement-product-order-usage.test.ts`

**Interfaces:**
- Consumes the shared helper with catalog `name/price` and draft `supplement.name/supplement.price`.

- [ ] **Step 1: Write failing usage assertions**

Assert both components import and use `orderSupplementProducts` for catalog, picker, and selected draft rendering.

- [ ] **Step 2: Implement ordered display arrays**

Use `useMemo` where appropriate and keep `lines` state unchanged.

- [ ] **Step 3: Run and verify GREEN**

Run ordering usage and existing picker tests.

### Task 3: Saved detail and PDF

**Files:**
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `src/features/supplements/coursePdf.ts`
- Modify: `tests/supplement-product-order-usage.test.ts`

**Interfaces:**
- Saved items use `supplementName/unitPrice`.

- [ ] **Step 1: Add failing detail/PDF usage assertions**

Assert both surfaces use the shared helper and no longer import `pdfItemOrder`.

- [ ] **Step 2: Implement shared ordering**

Order copied saved-item arrays before rendering details and PDF rows.

- [ ] **Step 3: Run and verify GREEN**

Run ordering tests and production type checking.

### Task 4: Execute approved permanent-delete plan

**Plan:**
- Execute every task in `docs/superpowers/plans/2026-07-23-delete-supplement-course.md` using TDD.

- [ ] **Step 1: Implement creator-only DELETE API**
- [ ] **Step 2: Pass current trainer identity to history**
- [ ] **Step 3: Add permanent-delete confirmation UI**
- [ ] **Step 4: Verify delete behavior**

### Task 5: Full verification and delivery

- [ ] **Step 1: Run all supplement tests**
- [ ] **Step 2: Run API TypeScript and production build**
- [ ] **Step 3: Commit both features and push main**

Commit as `feat: order products and delete owned courses`, stage only affected source/tests/plans, and push `origin main`.
