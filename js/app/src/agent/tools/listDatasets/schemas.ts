import { z } from "zod";

// Must agree with the server-owned PARAMETERS (list_datasets.py): an optional
// name substring filter, an optional row limit, and an optional pagination
// cursor.
export const listDatasetsInputSchema = z.object({
  nameContains: z.string().trim().min(1).optional(),
  labelNames: z.array(z.string().trim().min(1)).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  after: z.string().min(1).nullable().optional(),
});
