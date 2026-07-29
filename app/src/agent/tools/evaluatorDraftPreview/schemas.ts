import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export const MAX_EVALUATOR_PREVIEW_CASES = 10;
// Code previews run one at a time against the sandbox; LLM-judge previews
// allow limited parallelism because each case is an independent judge call.
export const CODE_EVALUATOR_PREVIEW_CONCURRENCY = 1;
export const LLM_EVALUATOR_PREVIEW_CONCURRENCY = 2;

export const evaluatorMappingSourceSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        input: ["inputs"],
        output: ["outputs"],
      }),
    z.object({
      input: z.record(z.string(), z.unknown()).optional(),
      output: z.record(z.string(), z.unknown()).optional(),
      reference: z.record(z.string(), z.unknown()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .transform((value) => ({
    input: value.input ?? {},
    output: value.output ?? {},
    reference: value.reference ?? {},
    metadata: value.metadata ?? {},
  }));

export const evaluatorPreviewCaseSchema = z.preprocess(
  (input) => normalizeAliases(input, { testPayload: ["test_payload"] }),
  z.object({
    id: z.string().trim().min(1),
    testPayload: evaluatorMappingSourceSchema,
  })
);

export const evaluatorDraftPreviewInputSchema = z
  .preprocess(
    (input) => (input == null ? {} : input),
    z.object({
      cases: z
        .array(evaluatorPreviewCaseSchema)
        .min(1)
        .max(MAX_EVALUATOR_PREVIEW_CASES)
        .optional(),
    })
  )
  .superRefine((input, context) => {
    if (!input.cases) {
      return;
    }
    const seenIds = new Set<string>();
    input.cases.forEach((previewCase, index) => {
      if (seenIds.has(previewCase.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate preview case id: ${previewCase.id}`,
          path: ["cases", index, "id"],
        });
      }
      seenIds.add(previewCase.id);
    });
  });

export function formatEvaluatorDraftPreviewInputError(
  error: z.ZodError
): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}
