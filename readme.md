# CAIAS Consultancy Portal

Online system replacing manual/Word-based consultancy registration at CAIAS. Manages the full consultancy lifecycle — registration, verification/approval, execution, payments, and closure — as one auditable master record per consultancy.

## Tech Stack

- **Framework:** Next.js (App Router)
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL
- **File Storage:** RustFS (S3-compatible)
- **Auth:** Keycloak SSO (Google as upstream identity provider) via Auth.js

## Core Concept

One `Consultancy` record is the parent for all related data (agreement, team, milestones, payments, documents, closure). It moves through statuses:

```
Draft → Submitted → Under Verification → Registered → Active → Closure Requested → Completed & Closed
```

Every status change, document upload, and payment update is recorded in an append-only audit trail.

## Roles

Faculty · HOD · IIIC Admin · Finance · Competent Authority · System Admin · Audit (read-only)

## Getting Started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, RUSTFS_*, KEYCLOAK_*
npx drizzle-kit generate
npx drizzle-kit push
npm run dev
```

## Build Plan

See `CAIAS_Consultancy_Backend_Build_Plan.md` for the full phase-by-phase backend implementation and testing plan.