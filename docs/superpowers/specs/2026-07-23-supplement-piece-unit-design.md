# Supplement Piece Unit Design

## Goal

Add `ชิ้น` as a valid supplement content unit throughout the catalog workflow.

## Behavior

- The superadmin catalog create and edit forms include `ชิ้น` in the content-unit dropdown.
- The supplements API accepts `ชิ้น` alongside `เม็ด`, `ช้อน`, `ซอง`, and `ใบ`.
- Course forms, history, and PDF documents continue to display the stored unit without special handling.

## Database Compatibility

- New `supplements` tables use a check constraint containing all five units.
- Runtime schema initialization replaces the existing content-unit constraint so deployed Neon databases accept `ชิ้น` automatically.
- The standalone `schema.sql` migration matches the runtime schema.

## Verification

- Add a regression test that checks the UI option, API validation, runtime constraint, and standalone schema.
- Run supplement tests, the API TypeScript check, and the production build.
