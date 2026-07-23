# Supplement Course Trainee Dropdown Design

## Goal

Replace the native trainee `<select>` in supplement course creation with the same searchable custom-dropdown interaction used by the body-metrics form.

## Interaction

- The closed trigger is full width and at least 48 pixels high.
- With no selection, show `เลือกลูกเทรน` in muted text.
- With a selection, show the trainee profile image or fallback avatar and nickname.
- Show a chevron that rotates while the dropdown is open.
- Opening displays an anchored panel below the trigger.
- The panel begins with a sticky `ค้นหาลูกเทรน...` field.
- Each option shows profile image/fallback and nickname.
- Highlight the currently selected trainee.
- Selecting an option updates `traineeId`, clears search, and closes the panel.
- Tapping the page overlay outside the panel closes it and clears search.
- Show consistent empty states for no linked trainees and no search matches.

## Scope and Authorization

- Only trainees passed to `SupplementCourseForm` are shown.
- Do not include `ลูกเทรนแบบกำหนดเอง`.
- Do not include `บันทึกค่าตัวเอง`.
- The API ownership check remains unchanged.
- Course save payload continues sending the selected trainee's `userId` as `traineeId`.

## Implementation Boundary

- Dropdown open/search state remains local to `SupplementCourseForm`.
- Add supplement-specific dropdown classes to the existing shared mobile stylesheet.
- Do not change body-metrics dropdown behavior in this task.

## Verification

- Open, search, select, re-open, change selection, and outside-click close.
- Confirm avatar fallback and selected highlighting.
- Confirm no trainees and no matching search states.
- Confirm saving still sends the selected linked trainee ID.
- Confirm mobile widths do not overflow and production build succeeds.

## Acceptance Criteria

- The course trainee picker visually and behaviorally matches the body-metrics custom dropdown.
- No native select spinner is shown.
- Unauthorized self/custom trainee choices are unavailable.
