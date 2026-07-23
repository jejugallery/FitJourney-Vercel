# Shared Trainee Supplement Course History Design

## Goal

Allow every trainer currently linked to a trainee to view that trainee's complete supplement course history, regardless of which linked trainer created each course.

## Authorization

- Firestore `trainees.trainerIds` is the source of truth for shared access.
- A trainer may list, open, and create a PDF download token for a course when the course trainee currently includes that trainer in `trainerIds`.
- Removing a trainer from `trainerIds` revokes access immediately.
- Course IDs and trainee IDs supplied by the client do not grant access by themselves.
- Course creation continues to require an active trainer-to-trainee link.

## History Behavior

- The unfiltered history list includes courses for every trainee linked to the current trainer.
- Filtering by one trainee returns all courses for that trainee from every linked trainer.
- Course details retain and display the original `trainer_name`.
- Existing ordering by course creation date remains unchanged.

## Course Ownership

- The original `trainer_id` and `trainer_name` remain immutable course attribution.
- Shared trainers gain read and PDF-download access only.
- No update or delete permissions are added.

## API Design

- Add an authorization helper that resolves trainee IDs linked to the current trainer.
- Unfiltered listing queries courses whose `trainee_id` is in that linked set.
- Filtered listing first verifies the trainer-to-trainee link.
- Detail lookup and PDF-token issuance load the course, then verify access through the course's `trainee_id`.
- Public PDF-token lookup remains token-authorized and unchanged.

## Verification

- Test that shared trainers can list, open, and issue PDF tokens for linked-trainee courses.
- Test that creator ownership is no longer required for read/PDF access.
- Test that unlinked trainers remain denied.
- Run supplement tests, API TypeScript checking, and the production build.
