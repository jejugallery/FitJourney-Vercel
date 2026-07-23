# Supplement Course Detail Price and Quantity Design

## Goal

Make saved course item details easier to read by separating package contents from purchased quantity and hiding zero discounts.

## Item Display

- Keep package contents on its own line, such as `30 เม็ด`.
- Show unit price multiplied by purchased quantity on a separate line, such as `฿1,000.00 × 2`.
- Show a zero-priced product as `ฟรี × 1`.
- Keep the saved net amount aligned on the right.
- Show `ลด ฿100.00` only when the item's discount amount is greater than 0.
- Do not show any discount text for a zero-discount item.

## Course Summary

- Keep subtotal and final net total visible.
- Show the total discount row only when `discountTotal > 0`.

## Scope

- Apply changes only to the saved course detail view.
- Do not change calculations, persisted data, history cards, or PDF formatting.

## Verification

- Test paid, free, discounted, and non-discounted item display rules.
- Test total discount visibility.
- Run supplement tests and the production build.
