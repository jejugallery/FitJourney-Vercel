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

### Course History

- Use the same spacing, radii, typography, muted metadata, and emphasized price treatment as the course product cards.
- Keep the trainee filter full width at the top.
- Render each history entry as a one-column mobile card containing trainee name, date, item count, final total, and an explicit `ดูรายละเอียด` action.
- Open details as an in-modal screen with a clear back action, not a second floating dialog layered over the main modal.
- Render historical product snapshots with the same image size and information order as course product cards.
- Place the final total and full-width `ดาวน์โหลด PDF` action at the bottom of the detail screen.
- Preserve newest-first sorting and existing history/PDF data behavior.

### Supplement Catalog

- Begin with a search field and a full-width `+ เพิ่มอาหารเสริม` action.
- Render catalog items as one-column mobile cards containing image, name, package content, price, active/archived state, and touch-friendly edit/archive actions.
- Use two columns only when the modal has sufficient desktop width.
- Do not show the catalog form and long product list simultaneously.
- Creating or editing opens a dedicated in-modal form screen with a clear back action and title.
- The form uses full-width fields in a vertical mobile layout: name, price, content quantity, content unit, image preview, image picker, and save action.
- Editing keeps the existing image unless a replacement is selected.
- Archived items remain visually muted and cannot be edited or archived again.
- Catalog search filters by product name without changing server behavior.

### Shared Visual System

- All three tabs use the same card border, background, corner radius, image treatment, metadata typography, and primary/secondary action hierarchy.
- Internal picker, history-detail, and catalog-form screens use the same back-button pattern and keep the modal title context visible.
- Loading, empty, no-search-results, and API-error states use the same centered state container.
- Feature actions use supplement-specific button classes and do not inherit sizing or margin rules from the global `.btn-primary` class.

## Responsive Behavior

- Mobile is the default layout.
- Tap targets are at least 44 pixels high.
- No horizontal scrolling is required within the course form.
- At wider widths, picker cards may use two columns and product controls may use available horizontal space, without changing interaction behavior.
- Existing modal tab behavior remains unchanged.

## State and Data Flow

- Product search and picker visibility remain local UI state in `SupplementCourseForm`.
- History detail/navigation remains local to `SupplementCourseHistory`.
- Catalog search and list/form navigation remain local to `SupplementCatalogPanel`.
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
- Confirm history filtering, details, back navigation, and PDF download remain usable at each target width.
- Confirm catalog search, create/edit form navigation, image selection, save, cancel, and archive controls remain usable at each target width.
- Confirm desktop remains usable and production build succeeds.

## Acceptance Criteria

- No narrow orphaned native dropdown or spinner appears beside the add button.
- A trainer can identify and add a supplement using image, name, package content, and price.
- Quantity and discount controls can be operated comfortably with one hand on mobile.
- Existing pricing, save, history, catalog, and PDF behavior is unchanged.
- Course, history, and catalog use one coherent card and navigation system.
