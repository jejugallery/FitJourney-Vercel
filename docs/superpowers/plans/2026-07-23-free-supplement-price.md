# Free Supplement Price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow superadmins to save zero-priced supplements and identify them clearly as free products.

**Architecture:** Extract supplement input validation into a small shared API helper so zero-price behavior is directly testable. Keep accounting totals numeric, while a focused display formatter renders zero catalog prices as `ฟรี`.

**Tech Stack:** React 19, TypeScript, Node test runner, Vercel Functions, Neon PostgreSQL

## Global Constraints

- A numeric price of exactly 0 is valid and means the supplement is free.
- Empty, non-numeric, and negative prices remain invalid.
- Catalog and course product displays use `ฟรี`; accounting totals remain numeric.
- No database migration is required.

---

### Task 1: API price validation

**Files:**
- Create: `api/_supplement-validation.ts`
- Modify: `api/_supplements-handler.ts`
- Create: `tests/supplement-validation.test.ts`

**Interfaces:**
- Produces: `parseSupplementInput(body: any)` returning normalized supplement input or throwing `HttpError`.

- [ ] **Step 1: Write the failing validation test**

```ts
test('accepts a zero price as a free supplement', () => {
  assert.equal(parseSupplementInput(validBody({ price: 0 })).price, 0);
});

test('rejects negative and missing prices', () => {
  assert.throws(() => parseSupplementInput(validBody({ price: -1 })));
  assert.throws(() => parseSupplementInput(validBody({ price: '' })));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-validation.test.ts`

Expected: FAIL because `api/_supplement-validation.ts` does not exist.

- [ ] **Step 3: Extract validation and allow zero**

Create `parseSupplementInput` with an explicit raw-price empty check, `Number.isFinite(price)`, and `price < 0`. Import it into `_supplements-handler.ts` and remove the local validator.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --experimental-strip-types --test tests/supplement-validation.test.ts`

Expected: all validation tests pass.

### Task 2: Catalog form and free-price labels

**Files:**
- Create: `src/features/supplements/priceDisplay.ts`
- Modify: `src/features/supplements/SupplementCatalogPanel.tsx`
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Create: `tests/supplement-price-display.test.ts`

**Interfaces:**
- Produces: `displayProductPrice(price: number): string`, returning `ฟรี` for zero and a formatted baht price otherwise.

- [ ] **Step 1: Write the failing formatter test**

```ts
assert.equal(displayProductPrice(0), 'ฟรี');
assert.equal(displayProductPrice(1250), '฿1,250.00');
```

- [ ] **Step 2: Run the formatter test and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-price-display.test.ts`

Expected: FAIL because `priceDisplay.ts` does not exist.

- [ ] **Step 3: Implement formatter and update UI validation**

Implement `displayProductPrice`. Change catalog validation from `price <= 0` to an explicit empty/non-finite/negative check, set the input minimum to `0`, and use the formatter in catalog cards, the course picker, and selected course line unit prices.

- [ ] **Step 4: Run the formatter test and verify GREEN**

Run: `node --experimental-strip-types --test tests/supplement-price-display.test.ts`

Expected: formatter tests pass.

### Task 3: Free-item calculations and full verification

**Files:**
- Modify: `tests/supplement-pricing.test.ts`

**Interfaces:**
- Consumes: `calculateCourseLine(0, quantity, discountType, discountValue)`.

- [ ] **Step 1: Add a free-item pricing test**

```ts
assert.deepEqual(calculateCourseLine(0, 2, 'custom', 500), {
  grossAmount: 0,
  discountAmount: 0,
  netAmount: 0,
});
```

- [ ] **Step 2: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/course-trainee-dropdown.test.ts tests/supplement-duplicate-lines.test.ts tests/supplement-pricing.test.ts tests/supplement-validation.test.ts tests/supplement-price-display.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Verify API TypeScript and production build**

Run: `npx tsc --ignoreConfig --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext --target es2023 --types node api/*.ts api/_*.ts`

Expected: exit code 0.

Run: `npm run build`

Expected: build succeeds; the existing large-chunk warning is acceptable.

- [ ] **Step 4: Commit and push main**

```bash
git add api/_supplement-validation.ts api/_supplements-handler.ts src/features/supplements/priceDisplay.ts src/features/supplements/SupplementCatalogPanel.tsx src/features/supplements/SupplementCourseForm.tsx tests/supplement-validation.test.ts tests/supplement-price-display.test.ts tests/supplement-pricing.test.ts docs/superpowers/plans/2026-07-23-free-supplement-price.md
git commit -m "feat: allow free supplement products"
git push origin main
```
