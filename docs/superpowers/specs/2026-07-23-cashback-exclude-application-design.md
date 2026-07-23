# Cashback Application Exclusion Design

## Goal

Exclude application-form products from supplement course cashback and allow trainers to disable cashback with a 0% option.

## Product Eligibility

- A course line is ineligible for cashback when its supplement name contains the Thai text `ใบสมัคร`.
- Matching is based on the saved supplement name and works regardless of surrounding text, such as `ใบสมัคร MEMBER` or `ใบสมัคร ABO`.
- Ineligible lines remain part of the course subtotal, discount, and trainee net payment.

## Cashback Calculation

- Cashback options are exactly `0%`, `3%`, `6%`, `9%`, `12%`, `15%`, `18%`, and `21%`.
- The default for a new course remains `3%`.
- The cashback base is the sum of net amounts for eligible lines only.
- The API recalculates the eligible base and cashback amount from current catalog data.
- Selecting `0%` always produces a cashback amount of 0.

## Display

- Hide the cashback amount row when the selected percentage is 0 or the calculated cashback amount is 0.
- Apply the same hiding rule in the course form, course history details, history cards, and PDF.
- The percentage dropdown remains visible in the course form so trainers can change 0% to another option.

## Persistence

- Continue storing `cashback_percent` and `cashback_amount` in `supplement_courses`.
- Existing course records remain unchanged.
- No database migration is required.

## Verification

- Test mixed normal and application-form lines.
- Test a course containing only application-form lines.
- Test the 0% option and the exact approved option list.
- Run all supplement tests, API TypeScript checking, and the production build.
