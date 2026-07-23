# Supplement Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign course creation, course history, and supplement catalog as one coherent mobile-first touch interface.

**Architecture:** Preserve APIs and domain behavior while replacing cramped native controls with local in-modal screens and shared feature-specific CSS. Each existing feature component owns its navigation/search state and communicates through its existing props.

**Tech Stack:** React 19, TypeScript 6, CSS, Vite 8.

## Global Constraints

- Mobile is the default layout and requires no horizontal scrolling at 320px width.
- Tap targets are at least 44px high.
- Existing pricing, save, history, catalog, ImgBB, authorization, and PDF behavior remains unchanged.
- Supplement actions do not use the global `.btn-primary` sizing rules.

---

### Task 1: Shared Mobile Visual System

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Produces: shared supplement button, card, state, back-navigation, search, picker-grid, quantity-stepper, history, and catalog classes.

- [ ] Replace compact grid/control rules with mobile-first single-column defaults.
- [ ] Add 44px feature-specific primary, secondary, danger, and back button styles.
- [ ] Add wider-screen enhancements under a media query without changing interaction behavior.

### Task 2: Course Creation and Product Picker

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`

**Interfaces:**
- Keeps: existing `CourseDraftLine` state and save payload.
- Adds: local `pickerOpen` and `productSearch` state.

- [ ] Replace dropdown/add row with a full-width picker action.
- [ ] Add searchable in-modal product-card selection screen and empty states.
- [ ] Convert added lines to vertical cards with quantity stepper and full-width discount controls.
- [ ] Convert summary/save action to feature-specific mobile styles.

### Task 3: Mobile Course History

**Files:**
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`

**Interfaces:**
- Keeps: list/detail API calls and PDF downloader.
- Changes: detail overlay becomes an in-component detail screen with back navigation.

- [ ] Render explicit history summary cards with `ดูรายละเอียด` action.
- [ ] Render detail product snapshot cards using the shared visual system.
- [ ] Add full-width PDF action and consistent loading/empty states.

### Task 4: Mobile Supplement Catalog

**Files:**
- Modify: `src/features/supplements/SupplementCatalogPanel.tsx`

**Interfaces:**
- Keeps: create/update/archive APIs and ImgBB upload.
- Adds: local `view` and `search` state.

- [ ] Split list and form into separate in-modal screens.
- [ ] Add catalog search and full-width create action.
- [ ] Render touch-friendly catalog cards and active/archived states.
- [ ] Render full-width mobile form controls, image preview, back/cancel, and save actions.

### Task 5: Verification and Commit

**Files:**
- Review: all files above

- [ ] Run TypeScript production build and confirm success.
- [ ] Inspect the final diff for behavior changes outside the approved UI scope.
- [ ] Commit the mobile-first redesign on `main`.
