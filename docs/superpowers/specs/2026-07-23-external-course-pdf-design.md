# External Supplement Course PDF Download Design

## Goal

Make supplement course PDF downloads reliable in LINE by moving them to an external browser page protected by a short-lived token.

## Course Workflow

- The course form primary button is labeled `บันทึก`.
- Saving a course does not generate or download a PDF.
- PDF download is available only from a saved course detail view.
- A successful save continues to refresh course history.

## Download Link

- The authenticated trainer requests a PDF token for one of their own courses.
- The API creates a cryptographically random token valid for 15 minutes.
- Neon stores only the SHA-256 token hash, course ID, creation time, and expiration time.
- The API returns an external URL containing the raw token.
- LINE opens the URL through `liff.openWindow({ external: true })`; normal browsers use `window.open`.

## External Page

- Add `/supplement-course-pdf?token=...` as a public app route outside `LiffProvider`.
- The page does not initialize LIFF or redirect to LINE login.
- It exchanges the token for the course snapshot through the existing `supplement-courses` API.
- It displays course identity and a user-initiated `ดาวน์โหลด PDF` button.
- Expired, unknown, or malformed tokens show a clear message instructing the trainer to return to course history and create a new link.
- The external page uses the existing PDF generator, including cashback visibility and PDF item ordering.

## API and Database

- Reuse the existing `/api/supplement-courses` Serverless Function.
- Authenticated token creation verifies course ownership.
- Public token lookup occurs before trainer authentication and returns only the matching course and saved item snapshots.
- Runtime schema initialization creates `supplement_course_pdf_tokens`.
- Expired tokens may be deleted during token creation; no background job is required.

## Security

- Raw tokens are returned once and never stored.
- Tokens use at least 32 random bytes.
- Token lookup compares SHA-256 hashes.
- Tokens expire after exactly 15 minutes.
- Token responses are marked `Cache-Control: no-store`.

## Verification

- Test token hashing and 15-minute expiration.
- Test public route isolation from `LiffProvider`.
- Test that course saving no longer calls PDF generation.
- Test the course detail external-browser action.
- Run supplement tests, API TypeScript checking, and the production build.
