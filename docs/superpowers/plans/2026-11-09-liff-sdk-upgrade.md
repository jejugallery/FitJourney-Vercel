# LINE LIFF SDK Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `@line/liff` from `^2.29.0` to `^2.32.0`, resolve build prerequisites, and verify full build and runtime compatibility.

**Architecture:** Update `@line/liff` dependency via npm, verify type definitions and bundle output, fix any TypeScript type issues in consumer files, and run build checks.

**Tech Stack:** React 19, TypeScript 6, Vite 8, `@line/liff@2.32.0`

## Global Constraints
- Target version for `@line/liff`: `^2.32.0`
- Zero build or TypeScript errors on `npm run build`
- Preserve existing LIFF flows (LiffContext, ShareEventPage, ShareKnowledgePage, SpyGamePage, PaymentPage)

---

### Task 1: Update Dependency and Install

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `@line/liff` package registry
- Produces: Installed `@line/liff@2.32.0` in `node_modules`

- [ ] **Step 1: Install @line/liff@^2.32.0 and sync dependencies**
  Run: `npm install @line/liff@^2.32.0 qrcode@^1.5.4 @types/qrcode@^1.5.6`

- [ ] **Step 2: Verify installed version**
  Run: `npm list @line/liff` to confirm `2.32.0` is installed.

---

### Task 2: Fix TypeScript Strict Type in Consumer Files

**Files:**
- Modify: `src/pages/SpyGamePage.tsx`

**Interfaces:**
- Consumes: `QRCode.toDataURL`
- Produces: Type-safe Promise handler `(url: string) => void`

- [ ] **Step 1: Update parameter typing in SpyGamePage.tsx**
  Change `.then((url) => setQrDataUrl(url))` to `.then((url: string) => setQrDataUrl(url))`

---

### Task 3: Build Verification & Code Quality

**Files:**
- Test: `npm run build`
- Test: `npm run lint`

- [ ] **Step 1: Run type check and Vite build**
  Run: `npm run build` (`tsc -b && vite build`) and verify it exits with 0.

- [ ] **Step 2: Check for any LIFF deprecation warnings or import issues in build output**
  Verify chunk output includes updated `@line/liff`.
