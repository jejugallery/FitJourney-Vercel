# Supplement Product Ordering Design

## Goal

Apply one consistent product ordering rule everywhere supplement products are displayed.

## Ordering Rule

Products are grouped and ordered as follows:

1. Products whose names contain `ใบสมัคร`, including zero-priced application products.
2. Paid non-application products.
3. Free non-application products.

Within each group, sort by product name using Thai locale-aware comparison. Products with the same name retain their original relative order.

## Surfaces

Apply the shared ordering rule to:

- Supplement catalog.
- Course product picker.
- Selected course draft lines.
- Saved course detail items.
- PDF item rows.

Course history cards are not product rows and remain ordered by course creation date.

## State and Calculations

- Sorting is display-only and does not mutate source arrays.
- Duplicate selected lines remain independent through `lineId`.
- Quantity, discounts, totals, cashback, persistence, and course attribution remain unchanged.

## Implementation

- Replace the PDF-only ordering helper with a generic stable product-order helper.
- The helper accepts product name and unit price selectors so catalog, draft, saved, and PDF item shapes use the same comparator.
- Existing free-application precedence remains unchanged.

## Verification

- Test application-first, paid-middle, free-last grouping.
- Test Thai name ordering inside every group.
- Test stable ordering for duplicate names.
- Test usage across all five product surfaces.
- Run supplement tests and the production build.
