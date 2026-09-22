import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { consultancyStatusEnum, workflowStageEnum } from "./enums";
import { departments } from "./departments";
import { users } from "./users";

/**
 * The master/parent entity. `consultancy_code` (CAIAS/CON/{year}/{seq}) is
 * only assigned transactionally on submit — it stays null while in `draft`.
 *
 * consultancy_type_code, team_type_code, currency_code and payment fields are
 * admin-editable master_data codes, not Postgres enums — see agreements.ts
 * for why (matches the field/dropdown spec's "master values should be
 * configurable" principle). Field names below track
 * CAIAS_Consultancy_Online_System_Field_Dropdown_Structure.docx sections
 * 2 (Registration), 3 (Area), 6 (Team), 7 (Financial), 8 (Scope), 10 (Resources).
 */
export const consultancies = pgTable(
  "consultancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyCode: varchar("consultancy_code", { length: 50 }),

    status: consultancyStatusEnum("status").notNull().default("draft"),
    workflowStage: workflowStageEnum("workflow_stage").notNull().default("none"),

    // Section 2 — Registration / Basic Details
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    departmentCoordinatorId: uuid("department_coordinator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    hodApproverId: uuid("hod_approver_id").references(() => users.id, { onDelete: "set null" }),
    facultyInChargeId: uuid("faculty_in_charge_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    academicYearCode: varchar("academic_year_code", { length: 20 }).notNull(),
    consultancyTypeCode: varchar("consultancy_type_code", { length: 100 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    consultancyAreaCode: varchar("consultancy_area_code", { length: 100 }).notNull(),
    consultancyAreaOther: varchar("consultancy_area_other", { length: 255 }),

    startDate: date("start_date"),
    originalCompletionDate: date("original_completion_date"),
    currentCompletionDate: date("current_completion_date"),
    actualCompletionDate: date("actual_completion_date"),

    // Section 5 conditional flags (documents live in the `documents` table)
    ndaRequired: boolean("nda_required").notNull().default(false),
    ipAgreementRequired: boolean("ip_agreement_required").notNull().default(false),

    // Section 6 — Consultancy Team
    teamTypeCode: varchar("team_type_code", { length: 100 }).notNull(),
    externalExpertInvolved: boolean("external_expert_involved").notNull().default(false),
    externalExpertDetails: text("external_expert_details"),
    rolesAndResponsibilities: text("roles_and_responsibilities"),

    // Section 7 — Financial Details (agreement-level payment terms live on `agreements`)
    totalValue: numeric("total_value", { precision: 14, scale: 2 }),
    currencyCode: varchar("currency_code", { length: 10 }).notNull().default("INR"),
    taxApplicable: boolean("tax_applicable").notNull().default(false),
    taxDetails: text("tax_details"),
    estimatedInstitutionalCosts: numeric("estimated_institutional_costs", {
      precision: 14,
      scale: 2,
    }),
    otherApprovedCosts: numeric("other_approved_costs", { precision: 14, scale: 2 }),

    // Section 8 — Scope of Work & Deliverables
    scopeOfWork: text("scope_of_work"),
    expectedOutcomes: text("expected_outcomes"),
    clientAcceptanceRequired: boolean("client_acceptance_required").notNull().default(false),

    // Section 10 — CAIAS Resources
    caiasResourcesRequired: boolean("caias_resources_required").notNull().default(false),
    laboratoryRequired: boolean("laboratory_required").notNull().default(false),
    equipmentRequired: boolean("equipment_required").notNull().default(false),
    softwareRequired: boolean("software_required").notNull().default(false),
    travelRequired: boolean("travel_required").notNull().default(false),
    externalExpertRequired: boolean("external_expert_required").notNull().default(false),
    resourceDetails: text("resource_details"),
    estimatedResourceCost: numeric("estimated_resource_cost", { precision: 14, scale: 2 }),

    currentVersion: integer("current_version").notNull().default(1),
    isLocked: boolean("is_locked").notNull().default(false),
    /**
     * Set by `verifyStage`'s "return" decision (Phase 6) to the list of
     * top-level column names the originating faculty may edit while
     * `status = clarification_required`. Cleared on resubmission.
     */
    flaggedFields: jsonb("flagged_fields").$type<string[]>(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "set null" }),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consultancies_code_idx").on(table.consultancyCode),
    index("consultancies_status_idx").on(table.status),
    index("consultancies_department_idx").on(table.departmentId),
  ]
);

/**
 * "Department(s) Involved" (Section 6, multi-select) — separate from the
 * single owning `departments.id` above.
 */
export const consultancyDepartments = pgTable(
  "consultancy_departments",
  {
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("consultancy_departments_pk").on(table.consultancyId, table.departmentId)]
);

/**
 * Per-academic-year sequence backing Consultancy ID generation
 * (CAIAS/CON/{academic_year}/{sequence}). A dedicated row per year avoids a
 * global sequence, and the INSERT ... ON CONFLICT DO UPDATE ... RETURNING
 * pattern (see lib/consultancy-id.ts) makes allocation atomic under
 * concurrent submissions.
 */
export const consultancyIdSequences = pgTable("consultancy_id_sequences", {
  academicYearCode: varchar("academic_year_code", { length: 20 }).primaryKey(),
  lastSequence: integer("last_sequence").notNull().default(0),
});
