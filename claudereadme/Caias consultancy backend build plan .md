# CAIAS Consultancy Portal — Backend Build Plan

**Stack:** Next.js (App Router) · Drizzle ORM · PostgreSQL · RustFS (S3-compatible object storage) · Keycloak + Google IdP via Auth.js

**How to use this file:** Build and fully test each phase before starting the next. Do not begin a phase until the previous phase's "Acceptance Criteria" all pass. Each phase should end with a working, testable slice of the backend — not partial code across phases.

---

## Phase 0 — Project Foundation

**Objective:** A running Next.js project with DB connectivity and environment config, nothing business-specific yet.

**Tasks:**
1. Initialize Next.js (App Router, TypeScript, `src/` structure).
2. Install and configure Drizzle ORM + `drizzle-kit` + `postgres`/`pg` driver.
3. Set up `.env` for: `DATABASE_URL`, `RUSTFS_ENDPOINT`, `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`, `RUSTFS_BUCKET`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
4. Set up `drizzle.config.ts` pointing at a dedicated schema/database for this app.
5. Create a health-check route (`/api/health`) that pings Postgres.
6. Set up project folder conventions: `db/schema/*.ts` (one file per entity group), `db/queries/*.ts`, `lib/`, `app/api/`, `app/(dashboard)/`.

**Acceptance Criteria:**
- `npm run dev` runs clean.
- `/api/health` returns DB connection success.
- `drizzle-kit generate` produces a migration with no errors on an empty schema.

---

## Phase 1 — Core Database Schema

**Objective:** All core tables exist and match the spec's data model, with proper enums and foreign keys — no API yet.

**Tasks:**
1. Define Postgres enums via `pgEnum` for: consultancy status, internal workflow stage, organization type, agreement type, payment terms, payment status, milestone status, document type, approval decision, role.
2. Create tables (Drizzle schema files): `departments`, `master_data` (generic config: consultancy areas, industries, academic years, etc.), `consultancies` (the master/parent entity), `clients`, `agreements`, `consultancy_team_members`, `deliverables`, `milestones`, `progress_updates`, `payment_schedules`, `payment_transactions`, `documents`, `client_acceptances`, `client_feedback`, `closures`, `approvals`, `extensions`, `audit_events`, `notifications`.
3. Every child table gets a `consultancy_id` FK back to `consultancies.id`.
4. `audit_events`: append-only design — `created_at` only, no `updated_at`, no soft-delete column (rows are never touched after insert).
5. Add DB-level constraint or trigger so `audit_events` only accepts INSERT (no UPDATE/DELETE) — enforce with a restricted Postgres role or a `BEFORE UPDATE/DELETE` trigger that raises an exception.
6. Run migration against local Postgres.

**Acceptance Criteria:**
- All tables created, FKs verified with `\d+` or Drizzle Studio.
- Attempting an `UPDATE`/`DELETE` on `audit_events` fails as expected (test this explicitly).
- Seed script inserts one row per table successfully (referential integrity holds).

---

## Phase 2 — Authentication & Role-Based Access

**Objective:** Users can log in via Keycloak (with Google as an upstream IdP), and every request can be resolved to a user + role.

**Tasks:**
1. Configure Auth.js with the Keycloak provider pointed at your realm.
2. Confirm Google IdP is linked at the Keycloak realm level (not duplicated in app code).
3. In the Auth.js `session` callback, map Keycloak `realm_access.roles` (or a custom claim) into `session.user.roles`.
4. Create a `lib/auth/requireRole.ts` helper usable in Server Actions and Route Handlers to assert role membership before proceeding.
5. Define the role set matching the spec: `faculty`, `hod`, `iiic_admin`, `finance`, `competent_authority`, `system_admin`, `audit_readonly`.
6. Create a `users` reference table (or view) synced from Keycloak claims — minimum: `keycloak_sub`, `name`, `email`, `department_id`, `roles[]` — used for FK references (e.g. `created_by`, `verified_by`) instead of storing Keycloak IDs as raw strings everywhere.
7. Protect all `app/(dashboard)/**` routes with middleware requiring a valid session.

**Acceptance Criteria:**
- Login via Google → Keycloak → app session works end-to-end.
- A logged-in user's role(s) are visible in `session.user.roles`.
- A Route Handler using `requireRole('finance')` correctly rejects a `faculty`-only user (test both allow and deny cases).

---

## Phase 3 — Master Data & Configuration APIs

**Objective:** All dropdown/master-data values are served from the DB, not hardcoded in the frontend, and are admin-editable.

**Tasks:**
1. Server Actions / Route Handlers for CRUD on `master_data` (departments, consultancy areas, industries, organization types, agreement types, payment terms, academic years, document types).
2. Restrict write access to `system_admin` only; read access to all authenticated roles.
3. Add an `audit_events` insert on every master-data change (config changes must be audited per spec Section 66).

**Acceptance Criteria:**
- GET endpoints return seeded master data correctly.
- Non-admin write attempt is rejected.
- Editing a master-data value produces exactly one audit event row with old/new value captured.

---

## Phase 4 — Consultancy Registration (Draft & Submit)

**Objective:** A faculty user can create a Draft consultancy, fill in required sections, and Submit it — with conditional-mandatory validation enforced server-side.

**Tasks:**
1. Zod schemas for: department details, client details, consultancy details, team, agreement, financial details, scope/deliverables, IP/confidentiality, resources — matching the field/dropdown doc exactly (field names, options).
2. Implement conditional-mandatory rules in Zod via `.superRefine()`: e.g. `Other` selected → specify field required; `IP Generated = Yes` → IP fields required; `Confidential = Yes` → NDA fields required; `CAIAS Resources Used = Yes` → resource details required.
3. Server Action: `createDraftConsultancy` — inserts a `consultancies` row with status `draft`, no ID sequence consumed yet.
4. Server Action: `submitConsultancyRegistration` — runs full validation (all sections, not just draft-level), and only on success:
   - Generates the Consultancy ID transactionally (`CAIAS/CON/{academic_year}/{sequence}`), using a DB sequence or `SELECT ... FOR UPDATE` to guarantee no duplicate/race condition.
   - Sets status → `submitted`, locks the record from ordinary edits.
   - Writes an `audit_events` row for the submission.
5. Enforce: submission blocked if the mandatory signed agreement document is not yet uploaded (Phase 5 dependency — stub this check for now if documents aren't built yet, then wire it in Phase 5).
6. Enforce: Expected Completion Date cannot precede Start Date; Agreement Date cannot be later than submission date if agreement is already executed.

**Acceptance Criteria:**
- Draft can be saved with incomplete data.
- Submit fails with clear field-level errors when required/conditional fields are missing.
- Successful submit produces a unique, correctly formatted Consultancy ID.
- Two near-simultaneous submissions (test with parallel requests) never produce a duplicate ID.
- Submitted record's core fields cannot be edited via a direct update call (only via a return-for-clarification path, built in Phase 7).

---

## Phase 5 — Document Storage (RustFS)

**Objective:** Files upload directly to RustFS via presigned URLs, with versioning tracked in Postgres, and the "mandatory agreement before submission" gate is real.

**Tasks:**
1. Route Handler: `POST /api/documents/presign` — generates a presigned PUT URL (via `@aws-sdk/client-s3` pointed at RustFS) for a given `consultancy_id` + `document_type`.
2. Server Action: `confirmDocumentUpload` — called after successful client-side PUT, writes a `documents` row: `document_category`, `original_file_name`, `system_file_name`/object key, `version`, `uploaded_by`, `uploaded_at`, `status`.
3. Re-uploading a document of the same category creates a new `documents` row with incremented `version`, never overwrites the RustFS object or the old row.
4. Route Handler: `GET /api/documents/:id/download` — issues a presigned GET URL, checks the requesting user's role/permission against the document's confidentiality level before issuing it.
5. Wire the Phase 4 submission gate to actually check for a `documents` row of category "Signed Agreement" before allowing submit.
6. (Stub acceptable for now, flag for later) malware-scan hook: a placeholder function `scanDocument(objectKey)` called after upload, before the document's status flips to `available`.

**Acceptance Criteria:**
- Upload → confirm → download round-trip works for a real file.
- Re-uploading the same document type creates version 2, not an overwrite; both versions remain retrievable.
- Submitting a registration without the mandatory agreement document is rejected; uploading it first allows submission.
- A user without document-view permission gets a 403 on `/download`, not a presigned URL.

---

## Phase 6 — Verification & Approval Workflow

**Objective:** Submitted consultancies route through configurable verification/approval stages, with Return-for-Clarification and Rejection paths.

**Tasks:**
1. Implement the dual status model: `status` (user-facing: Submitted, Under Verification, Clarification Required, Registered, Active, etc.) and `workflow_stage` (internal: HOD Verification Pending, CAIAS Verification Pending, Competent Authority Approval Pending, etc.).
2. `master_data`-driven approval configuration table: which stages are required (per department/category/value threshold) — read this at runtime, never hardcode which roles approve.
3. Server Actions: `verifyStage(consultancyId, decision: 'verify' | 'return' | 'reject', comments)` — role-checked against the current `workflow_stage`.
4. On "Return for Clarification": status → `clarification_required`, only originating department/faculty can edit the flagged fields, previous submitted version preserved (store as a JSON snapshot or a `consultancy_versions` table) before allowing edits.
5. On resubmission: create a new version, re-enter the verification chain from the correct stage (not necessarily from the start).
6. On approval through all configured stages: status → `registered`.
7. Every decision writes an `audit_events` row with approver, timestamp, decision, comments.
8. Rejection: Consultancy ID is never reused; record remains searchable/auditable but cannot proceed without an explicit re-registration.

**Acceptance Criteria:**
- A consultancy with only "CAIAS Verification" configured skips HOD verification entirely; one with both configured requires both, in order.
- Return-for-clarification correctly restricts editable fields to the flagged ones only.
- The previous (pre-clarification) version is retrievable from audit/version history after resubmission.
- A rejected consultancy's ID never reappears on a subsequent new registration.

---

## Phase 7 — Activation & Execution (Progress, Milestones)

**Objective:** A `registered` consultancy can become `active` only after all gates pass, and ongoing progress/milestone updates are recorded.

**Tasks:**
1. `activateConsultancy` Server Action: checks — agreement present, all required fields complete, all configured approvals complete, required conditional documents present, no unresolved clarification, not rejected/cancelled. Only then: `registered → active`, record activation timestamp + actor.
2. `addProgressUpdate` Server Action: date, reporting period, status (On Track/Delayed/On Hold/Completed), work completed/in progress, overall progress %, optional document uploads (reuse Phase 5).
3. `updateMilestone` Server Action: planned/actual dates, status, responsible consultant, remarks, supporting evidence.
4. Computed/derived fields (not stored as user input): days elapsed, days remaining, overdue milestones, overdue completion date — implement as a query/view, not a writable column.

**Acceptance Criteria:**
- Activation is blocked and returns a specific reason if any gate condition fails; passes cleanly when all are met.
- Progress % and status history are queryable in chronological order per consultancy.
- An overdue milestone is correctly flagged by the derived-fields query without manual input.

---

## Phase 8 — Extension, On-Hold, Cancellation, Termination

**Objective:** These four state transitions are implemented as explicit, audited actions — never as silent edits to existing fields.

**Tasks:**
1. `requestExtension`: stores original completion date (immutable), proposed date, reason, revised timeline, client consent flag, supporting document. Status: `Extension Requested`.
2. `decideExtension` (approve/reject): on approve, current completion date updates to the revised date while original remains in history; on reject, no change.
3. `putOnHold` / `resumeFromHold`: reason, start date, expected resume date, authorised-by; on resume, do not auto-mark as Delayed for time spent on hold.
4. `cancelConsultancy`: reason, date, initiated-by, financial status, outstanding obligations, approval if required — distinct from closure.
5. `terminateConsultancy`: reason, actual termination date, completed vs outstanding deliverables, financial status, client communication, approval if required.
6. All five actions write `audit_events`; none of them delete or overwrite the base consultancy record.

**Acceptance Criteria:**
- After an approved extension, both the original and revised completion dates are independently visible.
- On-hold period does not trigger a false "Delayed" flag from the Phase 7 derived-fields logic.
- Cancelled/terminated consultancies remain fully queryable and are excluded from "active" counts but not deleted.

---

## Phase 9 — Financials & Payment Tracking

**Objective:** Faculty can view (not edit) financial status; Finance role has exclusive write access to payment records; totals reconcile.

**Tasks:**
1. `payment_schedules` (planned stages/amounts) and `payment_transactions` (actual received amounts) as separate tables.
2. Server Actions restricted to `finance` role: `recordPaymentTransaction` (amount, date, institutional account reference, transaction reference, TDS/statutory deduction, remarks).
3. Validation: sum of `payment_transactions.amount` for a consultancy cannot exceed the agreement value without an explicit `authorised_adjustment` record; `Amount Pending = Total Value − Total Received − Authorised Adjustments` computed, not stored redundantly without a reconciliation check.
4. Faculty-facing read-only view: total value, amount received, amount pending, payment status — no write access to any of these fields via faculty-scoped Server Actions (enforce with `requireRole('finance')` on all write paths, tested explicitly).
5. Do not collect or store any personal faculty bank-account details anywhere in the schema.

**Acceptance Criteria:**
- A `faculty`-scoped call to any payment-write action is rejected.
- Overpayment beyond agreement value without an adjustment record is rejected with a clear error.
- Payment status (Not Invoiced/Partially Received/Fully Received/Overdue) is derivable and correct from the transaction history.

---

## Phase 10 — Closure Workflow

**Objective:** Closure can only complete when every configured closure gate is satisfied; financial exceptions are explicit and authorised.

**Tasks:**
1. `requestClosure`: only available once consultancy is `active`; captures actual completion date, deliverable completion status (Yes/Partially/No + reason if Partially), final outcomes, client acceptance (if configured as required), final report upload.
2. `closure gate checklist` implemented as a single server-side function returning pass/fail per item (final report uploaded, deliverables recorded, client acceptance present if required, Finance has verified financial status, any exception documented) — closure cannot proceed if any required item fails.
3. Financial exception path: if full payment not received, allow closure only with an explicit `authorised_exception` row (reason, amount outstanding, expected recovery action, authorising officer, date).
4. `verifyClosure` (IIIC/admin role): Closure Verified / Clarification Required / Returned for Correction.
5. On final approval: status → `Completed & Closed`, generate the Closure Record (aggregating registration + monitoring + closure data — this can be a read/query endpoint that assembles the three-stage record documented in the sample doc, rather than a duplicated denormalized table).
6. Auto-populate the Consultancy Register (a view/query over closed consultancies) rather than a manually maintained table.

**Acceptance Criteria:**
- Closure request is rejected if the final report isn't uploaded, with a specific missing-item message.
- Closure with unpaid balance succeeds only when an `authorised_exception` exists; fails otherwise.
- The generated Closure Record correctly aggregates data from all three lifecycle stages for a test consultancy.

---

## Phase 11 — Notifications & Scheduled Jobs

**Objective:** Time-based alerts and event-based notifications fire correctly. Since Next.js has no built-in scheduler, this phase makes that decision concrete.

**Tasks:**
1. Decide and implement: a cron job (system-level or Dokploy-scheduled) hitting a protected Route Handler (e.g. `/api/jobs/daily-checks`), secured by a shared secret header — not a public endpoint.
2. Daily job logic: flag consultancies 30 days from completion; flag completion-date-reached; auto-transition to `Delayed` if completion date passed with no extension on record; flag missing payment/closure.
3. Event-based notifications (on submit, verify, return, approve, reject, activate, closure events already built in prior phases) — insert into a `notifications` table keyed by user/role, with a `channel` field (portal, email) for future extension.
4. Email delivery can be stubbed/logged in this phase if no SMTP/provider is configured yet — the notification record and trigger logic are the priority, not the delivery channel.

**Acceptance Criteria:**
- Manually invoking the daily-check endpoint against seeded test data correctly flags the expected consultancies (one just past completion, one 30 days out, one with a valid extension that should NOT be flagged Delayed).
- Each workflow action from earlier phases produces the correct notification row(s) for the correct role(s).

---

## Phase 12 — Search, Filters, Reporting & Export

**Objective:** Admin/reporting queries work against the master consultancy record — no separate manually-maintained register.

**Tasks:**
1. Search/filter endpoint supporting the fields listed in the spec (Consultancy ID, department, faculty, client, status, dates, payment status, IP involvement, resource usage) with pagination.
2. Aggregate report queries: by status, department, academic year, client type, category; financial totals (value, received, pending) grouped by department/year.
3. Export endpoints: CSV/Excel (structured data) and a PDF summary — role-gated per spec (export permissions follow role-based access).

**Acceptance Criteria:**
- Filtering by a combination of 2–3 fields returns correct results against seeded data.
- Export produces a valid, correctly formatted file matching the filtered result set.
- A `faculty` role cannot export data outside their own department's scope (if that's the intended restriction — confirm against your role matrix).

---

## Phase 13 — Security, Audit Completeness & Hardening Pass

**Objective:** Cross-cutting checks that don't belong to a single feature — run this as a dedicated pass before considering the backend production-ready.

**Tasks:**
1. Confirm every Server Action / Route Handler has an explicit role check — grep for any mutation endpoint missing `requireRole`.
2. Confirm no endpoint allows physical deletion of a submitted/registered/active/closed consultancy or its children (only status transitions).
3. Confirm every state-changing action across all phases writes a corresponding `audit_events` row — write a test that walks the full lifecycle (draft → submit → verify → activate → progress → payment → closure) and asserts an audit trail exists for each step.
4. File-type validation and size limits enforced server-side on the presign endpoint (Phase 5), not just client-side.
5. Session timeout and re-authentication behavior confirmed via Auth.js config.
6. Rate-limit or otherwise protect the Consultancy ID generation path against abuse.

**Acceptance Criteria:**
- The full-lifecycle audit test (Task 3) passes with a complete, gapless trail.
- A scripted attempt to hit any mutation endpoint without the correct role fails on every single one (build this as an automated test suite, not manual spot-checks).

---

## Suggested Testing Approach Throughout

- Use a seed script (`db/seed.ts`) that creates one sample department, client, and consultancy per test run — reset the test DB between runs.
- Write integration tests per phase (not just unit tests) that exercise the actual Server Action / Route Handler, not just underlying functions — this catches role-check and validation wiring mistakes, which are the most likely failure mode in a spec this rule-heavy.
- Do not proceed to the next phase with failing or skipped tests from the current one — the workflow phases (6–10) build directly on each other's status/version logic, and bugs compound quickly if carried forward.

