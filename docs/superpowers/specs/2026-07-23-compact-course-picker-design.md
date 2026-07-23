# Compact Course Cards and Multi-Add Picker Design

## Goal

Reduce the vertical size of selected supplement cards and let trainers add multiple products without repeatedly leaving the product picker.

## Selected Course Cards

- Use a mobile-first compact layout.
- Reduce product image size and internal spacing.
- Keep product identity, price, and delete action in a compact header.
- Place the quantity stepper and discount dropdown on the same row when space permits.
- Keep tap targets usable on mobile.
- Show the custom discount input only when `กำหนดเอง` is selected.
- Keep gross amount, discount, and net amount in a compact single summary row.
- Allow controls to wrap on very narrow screens without horizontal overflow.

## Product Picker

- Tapping a product add button appends a new independent course line and keeps the picker open.
- Repeated taps on the same product append separate lines, preserving existing duplicate-line behavior.
- Each product card shows a selected-count badge using `เลือกแล้ว ×N` when its count is greater than zero.
- The picker header includes a clear `เสร็จสิ้น` action that returns to the course form.
- Closing the picker preserves every line added during that picker session.
- Product search continues to filter the catalog without changing selected counts.

## State and Accessibility

- Selected counts are derived from current draft lines by supplement ID, so deleting a line later updates the next picker visit.
- Product cards remain buttons with accessible labels that include the product name.
- The finish action is always visible in the picker header.

## Verification

- Test that repeated additions create independent lines and increment the selected count.
- Test that adding a product does not close the picker.
- Test the compact CSS hooks and responsive wrapping rules.
- Run all supplement tests, TypeScript checks, and the production build.
