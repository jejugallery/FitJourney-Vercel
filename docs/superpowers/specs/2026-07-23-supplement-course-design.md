# Supplement Course Design

## Goal

Add a trainer-side "จัดคอร์ส" workflow for creating supplement courses for linked trainees. Superadmins manage the shared supplement catalog, all approved trainers can create courses for their own trainees, saved courses remain available as trainer-only history, and each saved course can be downloaded as a Thai-language PDF.

## Scope

### Included

- A "จัดคอร์ส" button inside the existing Trainer card in `MetricsForm`.
- A modal with course creation, course history, and superadmin-only catalog management.
- Supplement creation, editing, and soft deletion by superadmins.
- Supplement image uploads through the existing ImgBB helper.
- Per-line quantity and discount calculation.
- Immutable historical snapshots of course line items.
- Automatic PDF download after a successful save and repeat download from history.

### Excluded

- Displaying supplement courses to trainees.
- Payment collection, payment status, inventory, stock deduction, fulfillment, or LINE delivery.
- Dosage instructions, per-item notes, and course-level notes.
- Restoring archived supplements in the initial UI.

## Roles and Authorization

- An approved trainer can open the feature, view the active supplement catalog, create a course, and view course history only for trainees whose Firestore `trainees.trainerIds` contains that trainer's LINE user ID.
- A superadmin has the same course permissions and can additionally create, edit, and archive catalog items.
- Trainees cannot open this modal or call its protected mutation endpoints.
- Catalog mutation authorization must be enforced by the API, not only by hiding controls in the UI.
- Course creation and history endpoints must enforce the trainer-to-trainee relationship. A client-provided role is not sufficient evidence of authorization.
- The authenticated actor is derived from the current LIFF session. API requests carry the LIFF access token; the server validates it and uses its LINE subject as the actor ID before checking the trainer record and trainee relationship.

## User Interface

### Entry Point

The Trainer card in `MetricsForm` receives a visible "จัดคอร์ส" button for approved trainers. The feature opens as a scroll-locked responsive modal consistent with the application's existing modal styling.

### Modal Tabs

1. **จัดคอร์ส** — available to approved trainers and superadmins.
2. **ประวัติคอร์ส** — available to approved trainers and superadmins.
3. **คลังอาหารเสริม** — rendered only for superadmins.

### Course Creation

The form requires the trainer to select one linked trainee before saving. It then shows the active supplement catalog and allows multiple products to be added as course lines.

Each line contains:

- Product image and name.
- Package content, displayed as `<content quantity> <content unit>` such as `30 เม็ด`.
- Unit price in Thai baht.
- Package quantity, meaning the number of jars, boxes, or packages sold. It is a positive integer and defaults to `1`.
- A discount dropdown with: no discount, 10%, 15%, ฿100, ฿500, and custom baht.
- A custom discount amount input shown only for the custom option.
- The calculated net line total.
- A remove-line control.

The bottom summary displays subtotal, total discounts, and final course total. Saving is disabled while a save is in flight and is rejected unless a linked trainee and at least one valid product line are present.

### Course History

History defaults to all courses created by the current trainer, newest first. The trainer can filter by one of their linked trainees. Each entry shows date, trainee, number of line items, and final total. Opening an entry shows its saved line-item snapshot and provides a "ดาวน์โหลด PDF" action.

### Catalog Management

The superadmin catalog tab lists active products and provides create and edit forms with:

- Name.
- Image file uploaded through `uploadToImgBB`.
- Price in Thai baht.
- Package content quantity.
- Package content unit: `เม็ด`, `ช้อน`, or `ซอง`.

Name is required, price must be greater than zero, content quantity must be a positive integer, unit must be one of the supported values, and image is required for a new product. Editing may retain the existing image. "ลบ" asks for confirmation and archives the product instead of physically deleting it.

## Pricing Rules

For each course line:

```text
gross = unit_price_snapshot × package_quantity
discount =
  0                         for no discount
  gross × 0.10              for 10%
  gross × 0.15              for 15%
  100                       for ฿100
  500                       for ฿500
  custom_discount_baht      for custom
net = gross - min(discount, gross)
```

Currency calculations use two-decimal precision. A fixed or custom discount cannot be negative and is capped at the gross line value, so a line total can never be negative.

Course totals are:

```text
subtotal = sum(line gross)
discount_total = sum(applied line discount)
total = sum(line net)
```

The browser shows immediate estimates, but the API recalculates all monetary values from current catalog prices during course creation. The API response is the authoritative saved snapshot used for history and PDF generation.

## Data Model

### `supplements`

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `image_url TEXT NOT NULL`
- `price NUMERIC(12,2) NOT NULL CHECK (price > 0)`
- `content_quantity INTEGER NOT NULL CHECK (content_quantity > 0)`
- `content_unit TEXT NOT NULL CHECK (content_unit IN ('เม็ด', 'ช้อน', 'ซอง'))`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_by TEXT NOT NULL`
- `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `updated_by TEXT NOT NULL`
- `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `archived_by TEXT`
- `archived_at TIMESTAMP WITH TIME ZONE`

### `supplement_courses`

- `id TEXT PRIMARY KEY`
- `trainer_id TEXT NOT NULL`
- `trainer_name TEXT NOT NULL`
- `trainee_id TEXT NOT NULL`
- `trainee_name TEXT NOT NULL`
- `subtotal NUMERIC(12,2) NOT NULL`
- `discount_total NUMERIC(12,2) NOT NULL`
- `total NUMERIC(12,2) NOT NULL`
- `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`

Trainer and trainee names are snapshots used by history and PDF output.

### `supplement_course_items`

- `id TEXT PRIMARY KEY`
- `course_id TEXT NOT NULL REFERENCES supplement_courses(id) ON DELETE CASCADE`
- `supplement_id TEXT NOT NULL`
- `supplement_name TEXT NOT NULL`
- `image_url TEXT NOT NULL`
- `content_quantity INTEGER NOT NULL`
- `content_unit TEXT NOT NULL`
- `unit_price NUMERIC(12,2) NOT NULL`
- `package_quantity INTEGER NOT NULL`
- `discount_type TEXT NOT NULL`
- `discount_value NUMERIC(12,2) NOT NULL`
- `gross_amount NUMERIC(12,2) NOT NULL`
- `discount_amount NUMERIC(12,2) NOT NULL`
- `net_amount NUMERIC(12,2) NOT NULL`
- `sort_order INTEGER NOT NULL`

Every presentation-relevant product and price field is copied into this table. Editing or archiving a catalog product therefore cannot change a historical course.

## API Design

### Catalog

- `GET /api/supplements` returns active items to approved trainers; superadmins may request archived items for management.
- `POST /api/supplements` creates a product and requires superadmin authorization.
- `PUT /api/supplements?id=<id>` edits an active product and requires superadmin authorization.
- `DELETE /api/supplements?id=<id>` sets `is_active = false` and audit fields; it requires superadmin authorization.

### Courses

- `GET /api/supplement-courses` returns courses created by the authenticated trainer, optionally filtered by an authorized `traineeId`.
- `GET /api/supplement-courses?id=<id>` returns one owned course and its ordered items.
- `POST /api/supplement-courses` validates trainee ownership, validates every active supplement, recalculates pricing, and inserts the course and all line items atomically.

The creation transaction fails as a unit; a partially saved course is never exposed.

## PDF Output

After the course API returns success, the client generates and downloads a PDF from the authoritative response. History uses the same PDF function, preventing format differences between first and repeat downloads.

The PDF contains:

- FitJourney branding.
- Course date.
- Trainer name.
- Trainee name.
- A table with product image, product name, package content, package quantity, unit price, discount, and net line amount.
- Subtotal, total discount, and final total.

The PDF supports Thai text and uses a stable A4 layout. Its filename follows `Supplement-Course-<trainee-name>-YYYY-MM-DD.pdf`, with unsafe filename characters removed. A PDF failure does not roll back a successfully saved course; the UI reports the failure and keeps a repeat-download action available in history.

## Error Handling

- Loading failures show an inline retry state without closing the modal.
- ImgBB upload failures leave the catalog form intact and do not submit an incomplete product.
- Unauthorized API responses show a clear permission message and refresh role-sensitive data.
- A catalog item archived or repriced while a trainer is composing a course is resolved by server validation. The save either uses the current authoritative price and returns it or fails with a refresh instruction if the item is no longer active.
- Duplicate save clicks are blocked while the request is pending.
- Validation messages identify the affected field or course line.

## Testing

- Unit tests cover every discount type, decimal currency, discount caps, invalid quantities, and aggregate totals.
- API tests cover superadmin catalog mutations, trainer catalog reads, unauthorized mutations, trainee relationship enforcement, snapshot creation, transactional failure, and archived-item rejection.
- Component tests cover tab visibility, trainee selection, line add/remove, custom discount input, calculated totals, validation, save states, and history filtering.
- PDF tests cover the mapped course snapshot, Thai labels, sanitized filename, product rows, and summary totals.
- Final verification runs the focused tests, full test suite, lint, TypeScript build, and production build.

## Acceptance Criteria

- An approved trainer can open "จัดคอร์ส" from the Trainer card and save a multi-item course for one of their linked trainees.
- Per-item discounts and the final total match the defined pricing rules.
- A superadmin can add, edit, and archive supplements with ImgBB-hosted images.
- A non-superadmin cannot mutate the catalog even by directly calling the API.
- A trainer cannot create or read a course for an unrelated trainee.
- Saved history remains unchanged after catalog edits or archival.
- The course remains trainer-only and is not shown in the trainee dashboard.
- A Thai PDF downloads after save and can be downloaded again from course history.
