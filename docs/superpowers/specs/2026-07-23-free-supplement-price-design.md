# Free Supplement Price Design

## Goal

Allow a superadmin to save a supplement with a price of exactly 0 baht. A zero-priced supplement represents a free product.

## Validation

- The supplement catalog create and edit forms accept numeric prices greater than or equal to 0.
- The supplements API accepts finite numeric prices greater than or equal to 0.
- Empty, non-numeric, and negative prices remain invalid.
- No database migration is required because the existing numeric price column supports zero.

## Display

- Display `ฟรี` instead of `฿0.00` for a zero-priced supplement in the catalog and course product picker.
- Display `ฟรี / ชิ้น` on a selected course line.
- Course line summaries, totals, course history, and PDF monetary totals remain numeric so accounting amounts are explicit.

## Calculations

- A free item has gross, discount, and net amounts of 0.
- Any selected discount on a free item produces a discount amount of 0.
- Cashback continues to be calculated from the final course net total, so a fully free course has cashback of 0.

## Verification

- Add a validation test proving zero is accepted and negative prices are rejected.
- Retain pricing tests proving free items cannot produce negative totals.
- Run the supplement tests, API TypeScript check, and production build.
