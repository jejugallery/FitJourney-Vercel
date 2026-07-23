# Supplement Course Cashback and Leaf Unit Design

## Goal

Add `ใบ` as a supplement package-content unit and calculate a trainer cashback snapshot from each course's final net total.

## Catalog Unit

- Add `ใบ` to the catalog create/edit unit dropdown.
- API validation accepts exactly `เม็ด`, `ช้อน`, `ซอง`, or `ใบ`.
- Neon check constraints accept the same four values.
- Existing supplement records remain unchanged.

## Cashback Selection

- Add one course-level dropdown to the course summary.
- Allowed values are exactly 3%, 6%, 9%, 12%, 15%, 18%, and 21%.
- Default to 3% for a new course.
- Cashback does not change the amount the trainee pays.

## Calculation

```text
cashback_amount = round(final_net_total × cashback_percent / 100, 2)
trainee_payment = final_net_total
```

Example: a final net total of ฿2,900 with 6% selected produces ฿174 cashback while the trainee still pays ฿2,900.

- The frontend provides an immediate estimate.
- The API validates the allowed percentage and recalculates cashback from its authoritative course total.

## Persistence

Add to `supplement_courses`:

- `cashback_percent NUMERIC(5,2) NOT NULL DEFAULT 0`
- `cashback_amount NUMERIC(12,2) NOT NULL DEFAULT 0`

Existing courses retain 0% and ฿0. Runtime schema initialization uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. The content-unit constraint is replaced with a constraint accepting all four units.

## Presentation

- Course summary shows the cashback percentage dropdown and `ได้เงินคืนภายหลัง` amount.
- History summary cards show cashback percentage and amount.
- History detail shows cashback below the final net total.
- PDF shows `ได้เงินคืน <percent>%` and the saved cashback amount.
- The trainee payment/final total remains visually distinct and unchanged.

## Data Contracts

- Course create request adds `cashbackPercent`.
- `SavedSupplementCourse` adds `cashbackPercent` and `cashbackAmount`.
- History and PDF consume saved values without recalculation.

## Verification

- Validate all seven allowed percentages and reject other values.
- Verify decimal rounding from final net totals.
- Verify cashback does not reduce the final total.
- Verify unit `ใบ` can be created, edited, read, and used in a course.
- Verify new and existing course rows return valid cashback values.
- Verify history and PDF map the saved snapshot.

## Acceptance Criteria

- Catalog items can use unit `ใบ`.
- Cashback is calculated from final net total only.
- The trainee payment remains the final net total.
- UI, history, API response, and PDF show the same saved cashback percentage and amount.
