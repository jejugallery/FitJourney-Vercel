# Supplement Course Mobile UI Redesign

## Goal

Replace the difficult mobile supplement selector and cramped course-line controls with a touch-first workflow while preserving all existing course calculations, APIs, history, catalog management, and PDF behavior.

## Current Problem

The product `<select>` and global `.btn-primary` share a horizontal flex row. The global button applies `width: 100%`, large padding, and top margin, squeezing the select into a narrow native control on mobile. A native dropdown also prevents trainers from comparing product images, package sizes, and prices before adding an item.

## Approved Interaction

### Course Header

- Keep the trainee selector full width.
- Replace the product dropdown and add button with one dedicated `+ เลือกอาหารเสริม` button.
- The button uses feature-specific styling and never inherits layout sizing from `.btn-primary`.

### Product Picker

- Open an in-modal picker panel when the trainer taps `+ เลือกอาหารเสริม`.
- Show a search field at the top.
- Show available products as touch-friendly cards containing image, name, package content, and price.
- Tapping a card adds it to the course and returns to the course view.
- Products already in the course do not appear in the picker.
- Provide an explicit close/back action and an empty search state.

### Added Product Cards

- Use a vertical card optimized for narrow screens.
- The top row contains product image, name, package content, unit price, and remove action.
- Package quantity uses large `−` and `+` buttons with the current number between them. Quantity never falls below 1.
- Discount selection occupies a full-width row.
- The custom-baht input appears as a separate full-width row only when `กำหนดเอง` is selected.
- Gross price, discount, and net line price are shown in a compact summary with net price emphasized.

### Course Summary

- Keep subtotal, total discount, final total, and the save/PDF action after the item cards.
- Use a feature-specific save-button class to avoid global width/margin conflicts.
- Keep the empty-course state immediately below the product-picker button.

## Responsive Behavior

- Mobile is the default layout.
- Tap targets are at least 44 pixels high.
- No horizontal scrolling is required within the course form.
- At wider widths, picker cards may use two columns and product controls may use available horizontal space, without changing interaction behavior.
- Existing modal tab behavior remains unchanged.

## State and Data Flow

- Product search and picker visibility remain local UI state in `SupplementCourseForm`.
- Adding, removing, quantity changes, discounts, calculations, and save payloads continue to use the existing `CourseDraftLine` model and pricing helpers.
- No database, API, authorization, or PDF schema changes are required.

## Error and Empty States

- When no products are available, the picker explains that the catalog is empty.
- When search has no matches, the picker shows `ไม่พบอาหารเสริม`.
- If all products are already selected, the selection button is disabled with clear text.
- Existing save validation and API error handling remain unchanged.

## Verification

- Confirm the selector and controls fit at 320px, 375px, and 430px widths without horizontal overflow.
- Confirm product search, add, remove, quantity decrement/increment, every discount type, custom discount, totals, and save still behave correctly.
- Confirm desktop remains usable and production build succeeds.

## Acceptance Criteria

- No narrow orphaned native dropdown or spinner appears beside the add button.
- A trainer can identify and add a supplement using image, name, package content, and price.
- Quantity and discount controls can be operated comfortably with one hand on mobile.
- Existing pricing, save, history, catalog, and PDF behavior is unchanged.
