# LINE LIFF SDK Upgrade to v2.32.0 - Design Specification

## Background & Objective
The FitJourney application currently uses `@line/liff` version `^2.29.0`. LINE has flagged versions `v2.20.0` through `v2.31.0` with a security vulnerability (CVE-2026-112148) involving query parameter handling and external browser redirects, and has begun restricting older versions.
LINE released version `v2.32.0` on November 9, 2026. The objective is to upgrade `@line/liff` to `^2.32.0` and ensure all build and runtime integrations remain stable and functional.

## Changes Required
1. **Dependency Upgrade:**
   - Update `@line/liff` to `^2.32.0` in `package.json`.
   - Run `npm install` to update `node_modules` and `package-lock.json` with `@line/liff@2.32.0` and required dependencies (including `qrcode` and `@types/qrcode` which are already declared in `package.json`).

2. **TypeScript & Build Fixes:**
   - In `src/pages/SpyGamePage.tsx`: Fix parameter type in `.then((url: string) => setQrDataUrl(url))` to satisfy `strict` TypeScript checks.
   - Verify that `npm run build` (`tsc -b && vite build`) completes with zero errors.

3. **LIFF API Verification:**
   - Verify compatibility of all existing LIFF API calls:
     - `liff.init({ liffId })`
     - `liff.isLoggedIn()`
     - `liff.login()`
     - `liff.getProfile()`
     - `liff.isInClient()`
     - `liff.closeWindow()`
     - `liff.openWindow()`
     - `liff.shareTargetPicker()`
     - `liff.sendMessages()`
   - Confirm no deprecated APIs are breaking under v2.32.0.

## Risk Assessment & Rollback
- Risk is minimal as `@line/liff` v2.32.0 maintains full backward compatibility with v2 APIs.
- Rollback: Revert `package.json` and `package-lock.json` back to `^2.29.0`.
