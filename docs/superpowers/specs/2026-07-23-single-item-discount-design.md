# Single-Item Supplement Discount Design

## Goal

Limit every supplement course-line discount to one unit while charging every additional unit at full price.

## Pricing Rule

For a course line:

```text
gross = unit_price × package_quantity
discount_base = unit_price
raw_discount =
  0                         for no discount
  discount_base × 0.10      for 10%
  discount_base × 0.15      for 15%
  100                       for ฿100
  500                       for ฿500
  custom_discount_baht      for custom
discount = min(max(raw_discount, 0), discount_base)
net = gross - discount
```

Example: a ฿1,000 product with quantity 3 and a 10% discount has a ฿3,000 gross amount, a ฿100 discount, and a ฿2,900 net amount.

## Behavior

- The rule applies independently to each supplement line.
- Percentage discounts use one unit price as their base, not the line gross amount.
- Fixed and custom-baht discounts cannot exceed one unit price.
- Quantities remain unrestricted positive integers.
- The course form displays `ส่วนลดใช้ได้กับ 1 ชิ้นเท่านั้น` near each discount control.
- The frontend pricing helper provides immediate estimates using this rule.
- The course API independently recalculates and authoritatively saves the same values.
- History and PDF continue displaying saved snapshot amounts without recalculation.
- Existing saved courses are not changed or migrated.
- No database schema change is required.

## Verification

- Cover quantities 1 and greater than 1 for every discount type.
- Cover a fixed/custom discount below, equal to, and above one unit price.
- Confirm frontend totals and API-saved totals match.
- Confirm old course snapshots remain unchanged.

## Acceptance Criteria

- No line receives more discount because its package quantity is greater than one.
- A line net amount equals full price for all extra units plus the discounted first unit.
- UI, saved history, and generated PDF show the authoritative values consistently.
