# Verification results — October 7, 2026

| Check | Actual result |
| --- | --- |
| React/Redux/API-client component and unit tests | 31 passed in 15 test files |
| Java API integration and unit tests | 12 passed in 3 test classes |
| Chromium browser tests using the running Java API | 2 passed |
| Vite UI production build | Passed; 66 modules, approximately 284 kB JavaScript / 91 kB gzip |
| Maven API compilation/package | Passed; Java source targets Java 17 and can run with Java 21 |
| Mobile Requirements layout at 390 px | No page-width overflow |

The browser test signs in with local project accounts and runs the real React → Redux → HTTP → Java → H2 workflow: create a draft with multiple engagement types, upload a document, download it, submit, return for correction, update income, preserve the saved SSN, resubmit and approve. It also verifies the three navigation links and mobile layout. The API suite additionally covers further review, covered-reason submissions with no activities, zero-hour educational enrollment, validation, stale versions, ownership, file deletion, encryption, CSRF, real session login and logout.

Production builds disable Rollup tree shaking because the tested dependency graph stalled with it enabled. The build still bundles and minifies the JavaScript. This setting is documented in `ui/vite.config.js`.

Test fixtures run only in tests. The delivered application contains no seeded applicant records. Credentials, generated environment files, test databases, dependencies and compiled build folders are excluded from the delivery.

The original repository was not available; the provided folder screenshot and HTML defined the implementation. External state-system submission, production identity integration, malware scanning and production hosting are not implemented. This is a runnable local course-project implementation.

Page previews are under `previews/`:
- `requirements-desktop.png`
- `requirements-mobile.png`
- `application-desktop.png`
- `review-desktop.png`
