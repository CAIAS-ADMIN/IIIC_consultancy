import { z } from "zod";

export const createMasterDataSchema = z.object({
  category: z.string().min(1).max(100),
  code: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateMasterDataSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
