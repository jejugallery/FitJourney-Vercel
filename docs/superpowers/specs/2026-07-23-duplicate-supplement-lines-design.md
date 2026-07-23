# Duplicate Supplement Course Lines Design

## Goal

Allow the same supplement to be selected multiple times in one course while preserving each selection as an independent line.

## Behavior

- Every product-picker tap creates a new course line even when that supplement already exists in the course.
- Lines are never merged by supplement ID.
- Each line owns its package quantity, discount type, custom discount value, calculated amounts, and remove action.
- The one-unit discount rule applies independently to every line.
- Product picker search always includes active supplements regardless of prior selections.
- History and PDF show duplicate supplements as separate rows in selection order.

## Client Identity

- Add a client-only `lineId` to `CourseDraftLine`.
- Generate a unique `lineId` every time the trainer selects a product.
- React keys and all update/remove operations use `lineId`.
- `supplementId` remains the catalog reference sent to the API.

## API Validation

- Course creation accepts repeated `supplementId` values.
- Remove the duplicate-supplement rejection.
- Load the set of unique supplement IDs only for catalog validation and price lookup.
- Validate, calculate, and snapshot every submitted line independently in original array order.
- Database course-item IDs remain unique, so no schema change is required.

## Verification

- Add the same supplement twice and confirm two independent cards appear.
- Change quantity and discount on one card and confirm the other card is unchanged.
- Remove one duplicate and confirm the other remains.
- Save duplicate lines and confirm API response, history, totals, and PDF preserve both rows and order.

## Acceptance Criteria

- Selecting an existing supplement always adds another line.
- No frontend or backend code combines duplicate lines.
- Each duplicate line calculates the one-item discount independently.
