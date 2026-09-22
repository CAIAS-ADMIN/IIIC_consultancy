import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

export const createPaymentScheduleSchema = z.object({
  stageLabel: z.string().min(1).max(255),
  plannedAmount: money,
  plannedDate: dateString.optional(),
});

export const recordPaymentTransactionSchema = z.object({
  amount: money,
  transactionDate: dateString,
  institutionalAccountRef: z.string().min(1).max(255),
  transactionRef: z.string().min(1).max(255),
  tdsDeducted: money.optional().default("0"),
  remarks: z.string().optional(),
});

export const createPaymentAdjustmentSchema = z.object({
  amount: money,
  reason: z.string().min(1),
});
