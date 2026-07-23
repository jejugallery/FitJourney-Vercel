# Single-Item Supplement Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply each supplement line discount to one unit only while all additional units remain full price.

**Architecture:** Keep the pure frontend pricing helper as the single pricing implementation and import it from the Vercel course API. Update the course UI explanation while leaving saved snapshots, history, PDF, and schema unchanged.

**Tech Stack:** TypeScript 6, Node test runner, React 19, Vercel Functions.

## Global Constraints

- Existing saved courses are never recalculated.
- Fixed/custom discounts are capped at one unit price.
- API-saved values remain authoritative.

---

### Task 1: Pricing Regression Test

**Files:**
- Create: `src/features/supplements/pricing.test.ts`

- [ ] Add cases for 3 × ฿1,000 with 10%, 15%, ฿100, ฿500, and custom discounts.
- [ ] Add a custom discount above unit price and confirm the cap is ฿1,000.
- [ ] Run the test and confirm current percentage behavior fails.

### Task 2: Shared Pricing Rule

**Files:**
- Modify: `src/features/supplements/pricing.ts`
- Modify: `api/supplement-courses.ts`

- [ ] Change discount percentage base and discount cap from line gross to one unit price.
- [ ] Export and use the same pure helper from the API, removing its duplicate pricing function.
- [ ] Run the pricing test and API TypeScript check.

### Task 3: UI Explanation and Verification

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`

- [ ] Add `ส่วนลดใช้ได้กับ 1 ชิ้นเท่านั้น` below each line discount label.
- [ ] Run the production build.
- [ ] Review and commit only the approved pricing/UI changes.
