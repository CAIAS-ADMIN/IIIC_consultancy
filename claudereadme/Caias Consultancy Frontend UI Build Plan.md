# CAIAS Consultancy Portal — Frontend UI Build Plan

**Stack:** Next.js App Router (same app as the backend, `src/app/(dashboard)/**`) · Tailwind CSS · shadcn/ui (Radix-based) components · the backend's existing REST routes from `Caias consultancy backend build plan .md` (all 13 phases already built and tested)

**Design basis:** the three reference screens supplied (`image.png` / `Screenshot 2026-09-22 150518.png` / `Screenshot 2026-09-22 150637.png` — Faculty Dashboard, New Consultancy wizard, Admin Overview) and the IIIC logo (`Centre-Logo-Finalized-IIIC-300x300.webp`). Theme: **minimal, mobile-first, generous whitespace, card-based**, matching the reference screens' look exactly rather than reinventing it.

**How to use this file:** same discipline as the backend plan — build and fully test each phase (including at mobile viewport widths, not just desktop) before starting the next. Every phase ends with real, clickable screens wired to the real backend routes, not static mockups.

---

## Design Reference Summary (read before Phase 0)

Pulled directly from the three reference screens — treat this as the literal spec until Phase 0 formalizes it into tokens:

- **Background**: warm off-white / cream (not pure white), e.g. `#F7F6F1`–`#FAF9F4`. Cards sit on it in pure white with a thin `1px` light-gray border, subtle or no shadow.
- **Primary green**: matches the logo's circle-blob green (buttons, active nav item, checkmarks, "Active" status). Approx `#3E8E41`–`#4CAF50` — sample the exact value from the logo file in Phase 0.
- **Accent orange**: matches the logo's "IIIC" wordmark (used sparingly — pending/warning stat numbers, some status badges). Approx `#F2994A`–`#F5821F`.
- **Status badge palette** (pill-shaped, colored background + darker text of the same hue): Active = green, Under Verification / HOD Verification / IIIC Verification / Pending = amber/orange, Competent Authority = light purple, Completed & Closed = neutral gray. One consistent badge component, color driven by a status→color map, not ad hoc per screen.
- **Typography**: clean sans-serif (Inter or similar system sans), bold dark headings, muted gray secondary text (e.g. "Academic Year 2026–27" under a page title).
- **Layout skeleton** (desktop): fixed left sidebar (logo top, nav list with icons, active item highlighted in light green, user profile pinned to the bottom) + main content area with a page header (title + subtitle + a right-aligned primary action or filter) + stat-tile row + a primary content card (table or queue).
- **Stat tiles**: small white cards, label in muted gray on top, large bold number below, one accent color per tile's meaning (orange for pending/attention, dark for neutral counts, green for value figures where relevant).
- **Tables**: header row in muted gray, generous row padding, right-aligned or icon "View →" affordance, status column rendered as a badge, no heavy grid lines.
- **Wizard (New Consultancy)**: horizontal numbered-circle stepper with a connecting line, green filled circle + check for completed steps, gray for upcoming; single-column form below with clear labels above inputs, placeholder text in gray, segmented Yes/No pill toggles for boolean questions; footer with Back / Save Draft / Continue actions.
- **Mobile**: none of the three references show a mobile layout — this is the one thing Phase 0 must originate, not copy. Sidebar → bottom tab bar or a slide-in drawer behind a hamburger; stat tiles → horizontal scroll or 2-column grid; tables → stacked card list (one card per row, label:value pairs); wizard stepper → collapse to a progress bar + "Step 2 of 4: Consultancy Details" label.

---

## Phase 0 — Design System & Foundations

**Objective:** Every later phase pulls from one shared set of tokens and primitive components — nothing is styled ad hoc per screen.

**Tasks:**
1. Install and configure Tailwind CSS + shadcn/ui in the existing Next.js app.
2. Extract real design tokens from the logo and reference screenshots: color palette (background, card, primary green, accent orange, status colors, text grays), spacing scale, border radius, font stack. Define as Tailwind theme config + CSS variables (so a future dark mode or rebrand is a token swap, not a rewrite).
3. Copy the logo into `public/brand/` (at minimum the square mark; ask for a wordmark-only / horizontal lockup variant if the sidebar ever needs one at a wider aspect ratio).
4. Build the primitive component set: Button (primary/secondary/ghost/destructive), Input, Select, Textarea, Checkbox/Radio, segmented Yes/No toggle, StatTile, StatusBadge (status→color map, one source of truth), Card, DataTable (with a mobile card-list fallback mode built in from day one, not bolted on later), Stepper, Modal/Sheet, Toast/notification banner, empty-state block, skeleton loaders.
5. Set the responsive strategy explicitly: mobile-first Tailwind breakpoints, a documented sidebar↔bottom-nav breakpoint (e.g. `md`), and a rule that every component built from here on is authored mobile-first and checked at 375px width before it's considered done.
6. A `/style-guide` route (dev-only, not linked in nav) rendering every primitive at both desktop and a simulated mobile width, for visual regression checks as the app grows.

**Acceptance Criteria:**
- `/style-guide` renders every primitive correctly at 375px and 1440px widths.
- Colors/spacing are only ever referenced via tokens (grep for hardcoded hex codes outside the token file — should find none in component code).
- StatusBadge covers every `consultancy_status` and `workflow_stage` enum value from the backend schema with an assigned color — no fallback/unknown state left undesigned.

---

## Phase 1 — App Shell & Authentication

**Objective:** A logged-in user of any role lands in a shell that already feels like the reference screens, on both desktop and mobile.

**Tasks:**
1. Sign-in screen: logo, "Sign in with Google" (via Keycloak), minimal centered card on the cream background.
2. Authenticated shell layout: sidebar (desktop) with logo, role-aware nav items (a `faculty` user sees Dashboard/New Consultancy/My Consultancies/Documents/Reports; `hod`/`iiic_admin`/etc. see the admin-oriented set from the Admin Overview reference — Overview/Verification Queue/All Consultancies/Departments/Reports), active-item highlight, user avatar + name + role pinned at the bottom.
3. Mobile shell: sidebar collapses to a bottom tab bar (primary 4–5 items) plus an overflow "More" sheet for the rest, or a slide-in drawer — pick one pattern and use it everywhere (recommend bottom tab bar for the 3–4 most-used items per role, matching how faculty/admin actually work one-handed on a phone).
4. Top bar: page title/subtitle slot, a notification bell placeholder (wired in Phase 10), department/academic-year switcher for admin roles (as seen in the Admin Overview reference's "All Departments" dropdown).
5. Session-expired / re-authentication handling (ties to the backend's 8-hour session `maxAge`): a clean re-sign-in prompt, not a raw error.

**Acceptance Criteria:**
- Google → Keycloak → app session works end-to-end from this UI, landing on the correct role's default screen.
- Shell renders correctly at 375px, 768px, and 1440px — no horizontal scroll, no overlapping elements.
- Nav items shown are correctly filtered by `session.user.roles`; a faculty user never sees an admin-only nav item even briefly during load (render after role is known, or skeleton the nav).

---

## Phase 2 — Faculty Dashboard (Consultancy List)

**Objective:** Reproduce the Faculty Dashboard reference screen exactly, backed by real data from `GET /api/consultancies` and the derived-fields/financial-summary endpoints.

**Tasks:**
1. Page header: "Consultancy Dashboard" + "Academic Year {code}" subtitle + primary "+ New Consultancy" button (top-right on desktop, becomes a floating action button or a full-width button under the header on mobile).
2. Stat tile row: Active / Pending Verification / Completed This Year / Total Value — real counts and totals from the backend (reuse Phase 12's aggregate/search endpoints rather than fetching everything and counting client-side).
3. "Recent Consultancies" table: ID, Client, Department, Status (badge), Value, "View →" link — collapses to a stacked card list on mobile (one card per consultancy: ID + client as the card title, the rest as labeled rows).
4. Empty state for a faculty user with zero consultancies yet (illustration/message + the New Consultancy CTA front and center).
5. Loading skeletons for the stat tiles and table while data fetches.

**Acceptance Criteria:**
- Visually matches the reference screenshot on desktop (spacing, tile order, table columns).
- On a 375px-wide viewport, the table becomes a usable stacked card list — no tiny unreadable text, no horizontal scrolling.
- Stat tiles and table reflect real backend data for a real logged-in faculty user (not placeholder numbers).

---

## Phase 3 — New Consultancy Registration Wizard

**Objective:** A faculty user can complete the full 4-step registration flow from the reference screen, hitting the real Phase 4 backend draft/submit endpoints, with every conditional-mandatory rule from the field/dropdown spec enforced in the UI (not just server-side).

**Tasks:**
1. Stepper header: Client Details → Consultancy Details → Team & Agreement → Review & Submit, with the checkmark/numbered-circle treatment from the reference. Mobile: collapse to "Step 2 of 4: Consultancy Details" + a thin progress bar.
2. Step 1 — Client Details: organization name/type (+ "Other" free-text reveal), designation, contact info, address fields, per the field/dropdown doc.
3. Step 2 — Consultancy Details (as shown in the reference): title, department, consultancy area, start/expected-completion dates, scope of work, and the Yes/No segmented toggles for IP-generation/NDA/etc. with their conditional detail fields revealed inline when "Yes" is selected.
4. Step 3 — Team & Agreement: team member list (add/remove rows), agreement type/value/payment terms, financial details.
5. Step 4 — Review & Submit: a read-only summary of all prior steps grouped by section, a mandatory-document checklist (flags the "Signed Agreement" gate from the backend before allowing submit), Submit action that calls the real submit endpoint and surfaces field-level validation errors by jumping back to the offending step.
6. "Save Draft" at every step (calls `createDraftConsultancy`/`PATCH`), so a faculty user can leave and resume — reflect draft status/last-saved time somewhere visible.
7. Client-side mirroring of the backend's `.superRefine()` conditional rules (Other→specify, Yes→detail required, date ordering) for immediate feedback, with the backend's response still the source of truth on submit.

**Acceptance Criteria:**
- A full run through all 4 steps produces a real submitted consultancy with a correctly formatted Consultancy ID displayed back to the user.
- Every conditional field from the spec shows/hides correctly as its trigger field changes.
- A left-mid-way draft is resumable later from "My Consultancies" and the wizard reopens on the correct step with prior data populated.
- Entire wizard is usable single-handed on a 375px viewport — no field requires horizontal scrolling or zooming to read/tap.

---

## Phase 4 — Document Upload UI

**Objective:** Faculty and reviewers can upload, version, and download documents through the real Phase 5 presign/confirm/download flow, with the new Phase 13 file-type/size rules surfaced clearly.

**Tasks:**
1. Per-category upload slot (Signed Agreement, NDA, IP Agreement, Deliverable, etc.) shown wherever documents are relevant (wizard Step 4, consultancy detail page, closure request): drag-and-drop on desktop, tap-to-pick (camera or gallery) on mobile.
2. Client-side pre-check against the allow-listed content types and the 25MB cap before even calling presign, with a clear inline error otherwise (matching the server's real limits from Phase 13 exactly — keep this list in one shared constant, not duplicated by hand).
3. Upload progress indicator (presign → PUT → confirm, all three legs reflected), success/failure states.
4. Version history list per category (v1, v2, ... with uploader + timestamp), all versions remain downloadable, current version visually distinguished.
5. Confidentiality-level indicator/selector on upload (public/internal/confidential/restricted), and a locked/disabled download affordance (not just a 403 after the fact) for a viewer who lacks permission — computed from the same visibility rule the backend uses.

**Acceptance Criteria:**
- A real file uploads, confirms, and downloads correctly through this UI end to end.
- A disallowed file type or oversized file is rejected in the UI before any network call, with a message matching what Phase 13's backend would say.
- Re-uploading the same category shows both versions, correctly ordered, both downloadable.

---

## Phase 5 — Verification & Approval UI

**Objective:** Reproduce the Admin Overview reference's Verification Queue exactly, and add the Verify/Return/Reject decision flows plus a full read-only consultancy review page.

**Tasks:**
1. Verification Queue (per the reference: consultancy code, department, client, current stage badge, Verify/Return buttons) — filtered to only the items whose current `workflow_stage` matches the logged-in user's role (or all, for `system_admin`). Mobile: stacked cards, actions as a bottom sheet.
2. Consultancy Review page: full read-only assembly of every registration section (client, consultancy details, team, agreement, financials, scope, resources) for a reviewer to actually evaluate before deciding — this is the page the Verify/Return/Reject buttons live on, not a bare list-row action.
3. Verify action: one click/tap, immediate optimistic UI update, moves to the next stage or "Registered".
4. Return-for-Clarification action: a modal/sheet with a comments field and a checklist of which fields are being flagged (multi-select from the consultancy's own field list) — mirrors the backend's `flaggedFields` array exactly.
5. Reject action: confirmation step (irreversible-feeling action), comments required.
6. Faculty-side clarification view: when a consultancy is `clarification_required`, the faculty's detail page highlights exactly the flagged fields (visually, e.g. an amber outline + inline comment) and only those fields are editable — everything else visibly locked/read-only.
7. Version history view (the pre-clarification snapshot) accessible from the detail page.

**Acceptance Criteria:**
- A `hod` role only sees HOD-stage items in their queue; an `iiic_admin` sees IIIC-stage items (or all, per the role matrix) — verified by logging in as each seeded test role.
- Return-for-clarification's field picker only ever offers real top-level fields the backend will accept (keep this list generated from/aligned with the backend's allow-list, not hand-maintained twice).
- The full queue-to-decision-to-resubmission loop works end to end against the real backend.

---

## Phase 6 — Consultancy Detail, Activation & Execution

**Objective:** One comprehensive detail page becomes the hub for everything that happens to a consultancy after registration — activation, progress updates, and milestones.

**Tasks:**
1. Detail page header: consultancy code, title, status + workflow-stage badges, key dates, and a role-gated action menu (Activate, Extend, Hold, Cancel, Terminate — wired in Phase 7).
2. Section layout: on desktop, tabs or a sticky side sub-nav (Overview / Team & Agreement / Financials / Documents / Progress & Milestones / History); on mobile, a vertically stacked accordion in the same order (tabs don't scale well to narrow screens with 6 sections).
3. Activation gate UI: for a `registered` consultancy, an "Activate" action that — if blocked — shows the *specific* list of failing reasons from the backend (not a generic error), each with a link/jump to the section that needs fixing.
4. Progress Updates: a form (date, reporting period, status, % complete, work done/in progress, optional document) plus a chronological history list/timeline below it.
5. Milestones: a list/timeline component (planned vs actual date, status, responsible person, remarks) with inline status updates; overdue milestones visually flagged (e.g. red left-border or icon) using the backend's derived-fields endpoint, not a client-side date guess.
6. Derived-fields summary strip: days elapsed / days remaining / overdue flag, shown prominently near the header once a consultancy is active.

**Acceptance Criteria:**
- Activation blocked-reason list matches the backend's `checkActivationGates` output 1:1, and updates live as blocking items are resolved.
- Overdue milestones are visually distinct without any manual client-side date math (trust `GET /api/consultancies/:id/derived`).
- All six sections render sensibly (no empty/broken sections) at 375px width.

---

## Phase 7 — Lifecycle Actions (Extension, Hold, Cancel, Terminate)

**Objective:** Surface these four audited state transitions as clear, role-gated actions on the detail page from Phase 6, never as silent field edits.

**Tasks:**
1. Extension: a request form (proposed date, reason, client consent) for the consultancy's own team; a separate approve/reject decision UI for oversight roles showing the original vs. proposed date side by side.
2. Hold / Resume: a simple reason + expected-resume-date modal; the detail page clearly banners an on-hold consultancy (so it's unmistakable progress/milestone entry is currently blocked).
3. Cancel / Terminate: a confirmation-weighted modal (distinguish these from routine actions — e.g. a secondary/destructive button style, a summary of financial/outstanding-obligation fields to fill in), each gated to the correct oversight roles per the backend's role matrix.
4. A unified "Lifecycle History" section on the detail page listing every extension/hold/cancel/terminate event with actor, date, and reason — this is largely a read view over the same `audit_events`/typed tables the backend already exposes.

**Acceptance Criteria:**
- Every action button is hidden (not just disabled) for a role that isn't permitted, matching the backend's exact role lists — verified against the same role matrix Phase 13's backend tests already encode.
- After an approved extension, both original and revised completion dates are visibly presented together, not one replacing the other.
- A cancelled/terminated consultancy's detail page clearly communicates its terminal state (banner, disabled further actions) while remaining fully readable.

---

## Phase 8 — Financials UI

**Objective:** A clear separation between finance's write access and everyone else's read-only view, matching the backend's exclusive-role model exactly.

**Tasks:**
1. Faculty/oversight-facing Financial Summary card: Total Value / Received / Pending / Payment Status (badge: Not Invoiced/Partially/Fully Received/Overdue), read-only, visible on the consultancy detail page.
2. Finance-only Payment Schedule editor: planned stages/amounts, simple add/edit rows.
3. Finance-only Record Payment form: amount, date, account reference, transaction reference, TDS/deduction, remarks — with the overpayment-ceiling error surfaced clearly if hit (and a path to the Authorised Adjustment record it needs).
4. Payment history table: schedule vs. actual transactions, so the two are visually comparable (e.g. a simple two-column or timeline comparison), not just two disconnected lists.
5. Authorised Adjustment form (finance/oversight roles) tied to the overpayment/closure-exception flows.

**Acceptance Criteria:**
- A faculty (or hod) session never renders any payment-write control, anywhere — not disabled, not shown-then-blocked, simply absent.
- Payment status badge always matches what `GET /api/consultancies/:id/financial-summary` returns — no independently-computed client-side status logic.
- An overpayment attempt shows the backend's specific rejection reason and a clear next step (create an adjustment).

---

## Phase 9 — Closure Workflow UI

**Objective:** Make the closure gate checklist and the exception path visually unambiguous — this is the phase most likely to confuse a non-technical user if done poorly.

**Tasks:**
1. Request Closure form: actual completion date, deliverable completion status (Yes/Partially/No + reason), final outcomes, client acceptance (if required), final report upload (reuses Phase 4's uploader).
2. Closure Gate Checklist component: one row per gate item (final report / deliverables / client acceptance / financial verification / exception-if-needed) with a clear pass/fail icon and the specific reason text when failed — this should visually be a literal checklist, not a paragraph of prose errors.
3. Financial Exception form (finance/oversight roles): reason, amount outstanding, expected recovery action, authorising officer, date — surfaced inline exactly when the checklist shows the financial gate failing.
4. Verify Closure decision UI (IIIC/admin role): Verified / Clarification Required / Returned, each with its own comment requirement.
5. Closure Record view: a clean, print-friendly (and exportable to PDF via the backend's existing export) read-only page aggregating registration + monitoring + closure data — this is the "sample doc" the spec describes, rendered from the real `GET /api/consultancies/:id/closure-record` endpoint.
6. Consultancy Register view: the auto-populated list of closed consultancies (`GET /api/consultancies/register`), styled consistently with the other list/table views from Phase 2.

**Acceptance Criteria:**
- The checklist UI's pass/fail state matches the backend's `checkClosureGates` output exactly, field for field.
- The Closure Record renders cleanly in print/PDF preview (no cut-off tables, no overlapping sections) — check this specifically, it's the one screen likely to be printed.
- Closure with an unpaid balance is visibly blocked until an exception exists, then visibly unblocked once one is created — no page reload required to see the state change.

---

## Phase 10 — Notifications UI

**Objective:** Every notification the backend already writes (Phase 11) becomes visible and actionable in the UI.

**Tasks:**
1. Notification bell in the top bar (wired up in Phase 1) with an unread-count badge, polling the backend on an interval (no websocket infrastructure exists — poll is the right call here, matching the backend's own "no built-in scheduler" decision in Phase 11).
2. Notification panel: dropdown on desktop, full-screen sheet on mobile, list of notifications newest-first, each linking through to the relevant consultancy, mark-as-read on open/click.
3. Empty state ("You're all caught up") and a reasonable cap/pagination for long lists.

**Acceptance Criteria:**
- Unread count matches the real count of unread notifications for the logged-in user/role.
- Clicking a notification navigates to the correct consultancy/section and marks it read.
- Panel is fully usable on a 375px screen (full-screen sheet, not a cramped dropdown).

---

## Phase 11 — Search, Reports & Export UI

**Objective:** Reproduce the Admin Overview reference's filtering/reporting feel at full depth, backed by Phase 12's search/reports/export backend.

**Tasks:**
1. Search/Filter bar: the fields from the backend's search endpoint (Consultancy ID, department, faculty, client, status, date range, payment status, IP involvement, resource usage), collapsible into a "Filters" sheet on mobile rather than a wide inline bar.
2. Results table (reuses the Phase 2 DataTable/card-list component) with pagination.
3. Aggregate report screens: by status / department / academic year / client type / category, and financial totals by department/year — simple bar/donut charts plus the underlying numbers in a table beneath (never chart-only; always let the numbers be read directly, especially on mobile where charts are hardest to read).
4. Export buttons (CSV, PDF) with a loading state and a toast/confirmation on completion; PDF export opens/downloads the real backend-generated file.
5. Faculty-scoped view: when a faculty user reaches this screen, the department filter is pre-locked to their own department (matching the backend's scoping) — reflect this as a disabled/locked filter, not a silently-ignored one, so it's not confusing.

**Acceptance Criteria:**
- A 2–3 field filter combination returns results matching what the equivalent direct API call returns.
- Export produces a real downloaded file matching the current filtered view.
- Charts and their underlying data tables both remain legible at 375px width (charts stack vertically, don't shrink to illegibility).

---

## Phase 12 — Master Data Admin UI

**Objective:** A `system_admin`-only screen set for managing dropdown values, so master-data changes never require a code deploy.

**Tasks:**
1. Category-grouped list view (consultancy areas, industries, organization types, agreement types, payment terms, academic years, document types, etc.) with add/edit/deactivate per row.
2. Edit modal per master-data row, calling the real Phase 3 CRUD endpoints.
3. A simple audit log view scoped to `entityType: "master_data"` events (old value → new value, actor, timestamp) — this is largely a filtered read over the existing audit trail.

**Acceptance Criteria:**
- Completely absent from navigation and unreachable (redirected) for any non-`system_admin` role.
- An edit here is immediately reflected in every dropdown elsewhere in the app that reads that category (no stale cached list).
- Every edit produces exactly one visible audit-log row with old/new values, matching the backend's Phase 3 acceptance criterion.

---

## Phase 13 — Responsiveness, Accessibility & Performance Polish

**Objective:** A dedicated final pass across every screen built in Phases 1–12 — this is where "mobile-optimized" gets verified, not assumed.

**Tasks:**
1. Full mobile audit: every screen from every prior phase, checked at 375px and 414px widths on a real or emulated phone (not just a resized desktop browser window) — touch target sizes (minimum ~44px), no accidental horizontal scroll, no text truncation that hides meaning.
2. Accessibility pass: color contrast (especially the status badge palette against its backgrounds), keyboard navigation through the wizard and tables, `aria-label`s on icon-only buttons, focus states visible on every interactive element.
3. Loading/skeleton states audited for consistency across every list/table/card screen (no screen shows a blank flash before data arrives).
4. Empty states audited for every list screen (zero consultancies, zero documents, zero notifications, zero search results) — each with a helpful message and, where relevant, a call to action.
5. Performance: image optimization for the logo/brand assets, route-level code splitting already provided by Next.js verified in practice (no single route pulling in the whole app's JS), a Lighthouse mobile run on the three or four heaviest screens (Dashboard, Wizard, Detail page, Reports).
6. Error boundaries and a consistent error/toast pattern for failed API calls, replacing any remaining raw/unhandled fetch failures.

**Acceptance Criteria:**
- Every screen passes a manual mobile walkthrough at 375px with no layout defects.
- An automated accessibility scan (e.g. axe) run against the built pages reports no critical/serious violations.
- Lighthouse mobile performance score is recorded for the heaviest screens and any score under a reasonable threshold (e.g. 80) is investigated, not just noted.

---

## Suggested Approach Throughout

- Build against the real backend from Phase 1 onward — no phase works from mocked/static JSON once the corresponding backend phase exists (it already all does, per the backend build plan).
- Treat the three reference screenshots as the literal spec for every screen they cover (Dashboard, Wizard, Admin Overview) — match them, don't reinterpret them, unless mobile constraints force a documented deviation (call it out where it happens).
- Every new screen is checked at 375px width the same session it's built, not deferred to Phase 13 — Phase 13 is a systematic *audit* pass, not the first time anything gets checked on a phone.
- Reuse the Phase 0 primitive set everywhere; if a screen seems to need a new one-off component, stop and ask whether it actually belongs in Phase 0's shared set instead.
