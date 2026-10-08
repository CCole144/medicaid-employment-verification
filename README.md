# Missouri Medicaid Verification and Employment (MOVE)

This is a complete Java Spring Boot + React Redux Toolkit monorepo based on your HTML and screenshots. There are exactly **three page routes**. Document upload is part of the Application page. Sign-in and covered-reason information are sections within these pages, not extra page routes.

| Page            | Route           | What works                                                                                                                                                                                        |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements    | `/requirements` | Information from the API, covered-reason information, Continue                                                                                                                                    |
| Application     | `/application`  | Personal information, multiple engagement types, monthly income, reporting month, explanation, save draft, PDF/JPG/PNG/DOC/DOCX upload, document download/delete, submit, correction/resubmission |
| Employee Review | `/review`       | Saved application list, masked personal information, engagement and education tables, total hours, documents, approval, further review, return for correction, review history                     |

The two HTML forms you supplied are now React components. Your `#4F7AC4` header/buttons, gray page background, white cards and blue upload/requirements panels are implemented in **SCSS**. Layouts adapt to phone and desktop widths. Runtime pages start empty; screenshot sample people and records are not seeded.

## Put the files in your existing repository

1. Extract `MOVE-React-Redux-Java.zip`.
2. Open your existing repository folder in **VS Code**.
3. Copy the contents of this package's `api` folder into your repository's `api` folder.
4. Copy the contents of this package's `ui` folder into your repository's `ui` folder.
5. Copy `scripts/`, root `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, and `README.md` to the repository root. Merge the `.github/workflows/ci.yml` test workflow into your existing `.github` folder if needed.
6. If files already exist with the same names, compare/merge them before replacing. Only the folder screenshot and HTML were supplied, so this package is a complete implementation, not a patch against unseen source files. In particular, merge dependencies and scripts if your repository already has `package.json` files.

`api/src/main/java/org/move/api/` is the Java package. If your existing API uses a different package, keep this source tree and its main application together, or rename the package and paths consistently. It runs with Java 17 or 21. This project uses **Vite**, not Create React App.

## Start in VS Code, step by step

Install a **JDK 17 or 21** and **Node.js 22.12+** (Node 24 also works). Maven is included through the wrapper; global Maven is unnecessary. The first run downloads dependencies, so internet access is required.

1. Click **Terminal → New Terminal** in VS Code. Make sure the terminal is at the repository root, the folder containing both `api` and `ui`.
2. Run:

```sh
npm ci
npm run setup
```

3. Open the newly generated root `.env` file in VS Code. It contains the `applicant` and `reviewer` usernames/passwords and randomly generated encryption/database keys. `npm run setup` preserves an existing `.env`. Do not commit this file. Keep the encryption key unchanged if you want to read existing saved data.
4. In that terminal, start Java:

```sh
npm run dev:api
```

5. Click the **+** in the Terminal panel to open a second terminal at the repository root. Run:

```sh
npm run dev
```

6. Open **http://127.0.0.1:5173**. Use this address consistently so the session cookie stays on one host. The API listens on `127.0.0.1:8080`.

For Git Bash, you can also run `cd api` then `./mvnw spring-boot:run`. For Windows PowerShell, run `cd api` then `.\mvnw.cmd spring-boot:run`. The root scripts select the appropriate wrapper automatically. Keep **`api/.mvn/wrapper/maven-wrapper.properties`** when copying the API; the wrapper requires it.

## Try the full workflow

1. Requirements → **Continue**.
2. Sign in as `applicant` using the generated password from `.env`.
3. Fill in personal information, reporting month, engagement entries and monthly income. The SSN format is `XXX-XX-XXXX`. Use **Add another engagement type** to combine activities.
4. For Education, enter the school, ID, program and attendance level. Full time, half time and less than half time are separate choices. Education does not require an 80-hour input to submit.
5. Click **Save application**. This creates a saved draft, not a submitted application.
6. Choose a document type, date and file. Click **Upload document**. You can download or delete saved documents while the application is editable.
7. Click **Submit application** after at least one document exists. Staff can now see the submission and applicant editing is locked.
8. Sign out. Open **Employee Review** and sign in as `reviewer` using the other generated password.
9. Select the application. Review the information and documents. Approve it, send it for further review or return it for correction. A note is required for further review or correction.
10. If returned, sign back in as the applicant, open the application from **My Applications**, correct it, save and submit again. Employee decisions are retained in Review History.

`Approve & Submit` records the employee's approval in this project database. It does **not** send an eligibility decision to a Missouri state system. Nothing here connects to Salesforce; this is the separate MOVE project shown in your current screenshots.

## How the UI connects to the API

React components dispatch Redux Toolkit async thunks. The thunks use `ui/src/api/client.js`, which makes relative `/api/...` requests with the session cookie and CSRF header. Vite forwards `/api` requests to the Java API. The browser sees one origin, so local CORS configuration is unnecessary. Database operations run in the Java service, not in React.

The API returns the updated application after saves, uploads, submission and review decisions. Redux updates the application list and current selection from that response. Updates, submission and review decisions send the last known `version`; stale tabs receive a conflict instead of overwriting newer changes. The **Reload saved data** control refreshes an applicant's current record.

All application records and uploaded bytes are stored in the file-based H2 database under `api/data/`. They survive an API restart. Application payloads and document bytes use AES-GCM encryption with `MOVE_ENCRYPTION_KEY`. Account passwords are BCrypt-hashed when the server starts. Neither personal records nor login passwords are stored in browser localStorage. The SSN is never returned in full. Redux DevTools are disabled. Document downloads require authorization and use `Cache-Control: no-store`.

The two generated accounts make this a runnable local course project. There is one applicant account, not a registration system. For a real multi-applicant rollout, replace `SecurityConfig` with your identity provider; the ownership checks already use the authenticated username.

## Tests and build

Run at the repository root:

```sh
npm run test:ui
npm run test:api
npm run build:ui
```

For UI coverage:

```sh
npm run test:coverage --workspace ui
```

Java coverage is written to `api/target/site/jacoco/index.html`. UI coverage is written to `ui/coverage/index.html`.

For real-browser tests with the Java API (run `npm run setup` first):

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the API and UI automatically when they are not running. The end-to-end test creates a clearly named test application in the local database; unit and API integration tests use fixtures and an isolated in-memory test database. There is no demo-data API mode.

Every React page/component, Redux slice, the API client and store have a test file. Java integration tests exercise the controllers, service, repositories, entities, validation, real session login, CSRF, ownership checks, state transitions and error responses. Encryption and file validation have focused unit tests. The CI workflow runs both suites, UI build and browser tests.

See **TEST_RESULTS.md** for the actual checks run on this delivered version and **API_CONTRACT.md** for endpoint details.

## Places to customize

Search the source for `CHANGE` comments:

- `SecurityConfig.java`: local accounts → your identity provider and staff roles.
- `ApplicationController.java`: have the business owner approve requirements text and official guidance links.
- `application.properties`: managed database, HTTPS deployment and secure session-cookie configuration.
- `FilePolicy.java`: file signature/structure checks are implemented. Add antivirus scanning and quarantine before accepting real public uploads.
- `ui/src/styles.scss`: your shared colors, spacing and responsive layout.

Applicants may report a covered reason without activity entries; staff review the explanation and proof.

The app collects records and records a human review. It does not automatically decide Medicaid eligibility or deny submissions for having fewer than 80 reported hours. The information page links to current official CMS guidance; business rules need state review before public use.

For deployment, serve `ui/dist` and proxy `/api` to the Java service on the same HTTPS origin, or configure an explicit approved cross-origin setup. The included Vite server is a development server. This delivery is a local course-project implementation; it is not a production Medicaid processing system.
