import { z } from "zod";

/**
 * The slice of an evaluator's input schema the form reads and writes: each
 * input's description. The rest of the schema is the server's, inferred from
 * the evaluator's prompt or code, so a malformed entry is dropped rather than
 * failing the whole read.
 */
export const evaluatorInputDescriptionsSchema = z.looseObject({
  properties: z
    .record(
      z.string(),
      z.looseObject({ description: z.string().optional() }).catch({})
    )
    .catch({}),
});

/** What an evaluator mutation takes as `inputSchema`. */
export const evaluatorInputSchemaInputSchema = z.object({
  type: z.literal("object"),
  properties: z.record(
    z.string(),
    z.object({ description: z.string().optional() })
  ),
});

export type EvaluatorInputSchemaInput = z.infer<
  typeof evaluatorInputSchemaInputSchema
>;
