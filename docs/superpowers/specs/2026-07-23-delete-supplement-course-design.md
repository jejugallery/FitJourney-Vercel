# Delete Supplement Course History Design

## Goal

Allow only the trainer who created a supplement course to permanently delete that course history.

## Authorization

- The delete action is available only when the current trainer's user ID equals the course `trainer_id`.
- Linked co-trainers retain view and PDF-download access but cannot delete.
- The API independently verifies creator ownership and never trusts frontend visibility.
- Superadmin receives no delete override unless they are the original creator.

## User Interface

- Place `ลบประวัติคอร์ส` in the saved course detail view.
- Hide the button for non-creators.
- Before deletion, show a confirmation that includes the trainee name and states the action is permanent and unrecoverable.
- Disable the action while deletion is in progress.
- On success, close the detail view, refresh history, and show a success message.
- On failure, keep the detail open and show the API error.

## API and Data

- Add `DELETE /api/supplement-courses?id=...`.
- Require trainer authentication.
- Delete only with `WHERE id = courseId AND trainer_id = actor.userId`.
- Return 404 when no creator-owned course matches.
- Existing foreign keys permanently cascade deletion to course items and PDF tokens.
- Deleted data cannot be recovered.

## Verification

- Test that only creator-owned rows are deletable.
- Test that the detail delete button is creator-only.
- Test confirmation and history refresh behavior.
- Run supplement tests, API TypeScript checking, and the production build.
