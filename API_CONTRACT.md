# MOVE API contract

JSON errors contain `message` and optionally `fields`. Dates use `YYYY-MM-DD`, reporting months use `YYYY-MM`, timestamps use UTC ISO 8601 and IDs are UUIDs. All `/applications` endpoints require a session.

| Method | Endpoint                                        | Body / query                                        | Result                                                             |
| ------ | ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/requirements`                             | none                                                | Public informational copy and official guidance URL                |
| GET    | `/api/csrf`                                     | none                                                | `{token, headerName}` for the current browser session              |
| POST   | `/api/login`                                    | Form-encoded `username` and `password`; CSRF header | 204 + authenticated session cookie                                 |
| GET    | `/api/me`                                       | none                                                | `{username, role}`                                                 |
| POST   | `/api/logout`                                   | CSRF header                                         | 204, session invalidated                                           |
| GET    | `/api/applications`                             | none                                                | Applicant's own records; staff see all submitted/non-draft records |
| POST   | `/api/applications`                             | `ApplicationInput` JSON                             | 201 + saved DRAFT                                                  |
| GET    | `/api/applications/{id}`                        | none                                                | Authorized `ApplicationView`                                       |
| PUT    | `/api/applications/{id}?version=N`              | `ApplicationInput` JSON                             | Updated DRAFT/RETURNED record                                      |
| POST   | `/api/applications/{id}/submit?version=N`       | none                                                | SUBMITTED record; requires a document                              |
| POST   | `/api/applications/{id}/documents`              | Multipart `file`, `documentType`, `documentDate`    | Updated record with document metadata                              |
| GET    | `/api/applications/{id}/documents/{documentId}` | none                                                | Authorized file download                                           |
| DELETE | `/api/applications/{id}/documents/{documentId}` | none                                                | 204, editable applicant record only                                |
| POST   | `/api/applications/{id}/decision?version=N`     | `{decision, note}`                                  | Updated record; staff only                                         |
| GET    | `/api/applications/{id}/history`                | none                                                | Immutable recorded decision history                                |

All POST/PUT/DELETE requests require the header returned by `/api/csrf`. Get a fresh token after successful login or logout. Session cookies are handled by the browser. Never send credentials or keys through URLs.

## ApplicationInput

```json
{
  "lastName": "Cole",
  "middleInitial": "C",
  "firstName": "Cameron",
  "dob": "2000-01-01",
  "ssn": "123-45-6789",
  "monthlyIncome": 740,
  "reportingMonth": "2026-01",
  "coveredReason": "",
  "engagements": [
    {
      "type": "EMPLOYMENT",
      "name": "Employer",
      "organizationId": "123",
      "hours": 40,
      "program": "",
      "attendance": null
    },
    {
      "type": "VOLUNTEERING",
      "name": "Agency",
      "organizationId": "456",
      "hours": 40,
      "program": "",
      "attendance": null
    }
  ]
}
```

This example is documentation only. No records are seeded. First/last names, past DOB, SSN, nonnegative monthly income, a nonfuture reporting month and up to 20 engagement entries are supported. Either at least one activity or a nonempty covered-reason explanation is required. The middle initial is optional. Updates may send blank or null SSN to preserve the encrypted existing value.

Types: `EMPLOYMENT`, `VOLUNTEERING`, `EDUCATION`, `JOB_TRAINING`. Education requires `program` and `attendance` (`FULL_TIME`, `HALF_TIME`, `LESS_THAN_HALF_TIME`). Each entry contains a numeric nonnegative `hours` value; UI education entries default blank hours to zero. Server caps each entry at 744 reported monthly hours as a data-quality limit, not an eligibility rule.

Document types: `PAY_STUB`, `EMPLOYER_LETTER`, `SCHOOL_RECORD`, `VOLUNTEER_RECORD`, `TRAINING_RECORD`, `OTHER`. Required document date cannot be in the future. File limit: 10 MB/file and 20 documents/application. The server validates supported file signatures and DOCX structure; accepted formats are PDF, JPEG, PNG, DOC, DOCX. Downloads use attachment disposition.

ApplicationView contains `id`, `version`, `status`, personal fields with `ssnMasked` instead of `ssn`, `engagements`, `totalHours`, `documents`, `reviewNote`, `createdAt`, and `updatedAt`. Decisions: `APPROVE`, `FURTHER_REVIEW`, `RETURN`; a nonempty explanation is required for the last two.

## State rules

- DRAFT: applicant can edit/upload/delete and submit. Staff cannot see drafts.
- SUBMITTED: staff can approve, return, or send for further review. Applicant record is locked.
- FURTHER_REVIEW: staff can make another decision; applicant record is locked.
- RETURNED: applicant can correct/upload/delete and resubmit.
- APPROVED: read only for both roles.

Ownership or wrong document/application pairs return 404. Wrong-role actions return 403. Stale versions or prohibited transitions return 409. Invalid input returns 400, oversize HTTP uploads return 413, and unsigned sessions return 401.
