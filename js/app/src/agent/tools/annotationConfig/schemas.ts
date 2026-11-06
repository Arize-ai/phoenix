import { z } from "zod";

const optimizationDirectionSchema = z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]);

const categoricalValueSchema = z.object({
  label: z.string().min(1),
  score: z.number().nullable().optional(),
});

/** Fields shared by create and update (everything but `id` / `projectId`). */
const annotationConfigDraftShape = {
  type: z.enum(["categorical", "continuous", "freeform"]),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  optimizationDirection: optimizationDirectionSchema.optional(),
  values: z.array(categoricalValueSchema).optional(),
  lowerBound: z.number().nullable().optional(),
  upperBound: z.number().nullable().optional(),
  threshold: z.number().nullable().optional(),
};

export const createAnnotationConfigInputSchema = z.object({
  ...annotationConfigDraftShape,
  projectId: z.string().min(1).nullable().optional(),
});

export const updateAnnotationConfigInputSchema = z.object({
  id: z.string().min(1),
  ...annotationConfigDraftShape,
});
