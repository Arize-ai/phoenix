import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

const languageSchema = z.enum(["PYTHON", "TYPESCRIPT"]);

const inputMappingSchema = z
  .object({
    pathMapping: z.record(z.string(), z.string()).optional(),
    literalMapping: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .transform((value) => ({
    pathMapping: value.pathMapping ?? {},
    literalMapping: value.literalMapping ?? {},
  }));

const optimizationDirectionSchema = z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]);

/**
 * Optional freeform output config the model can attach at evaluator-creation
 * time. Mirrors the code-evaluator form's single-freeform-config shape; the
 * evaluator's `name` is reused as the annotation config name at dispatch
 * time, so the model does not supply one here. Inner snake_case keys
 * (`optimization_direction`, `lower_bound`, `upper_bound`) are accepted via
 * a per-block alias preprocess before zod parsing.
 */
const outputConfigSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      optimizationDirection: ["optimization_direction"],
      lowerBound: ["lower_bound"],
      upperBound: ["upper_bound"],
    }),
  z.object({
    optimizationDirection: optimizationDirectionSchema.nullish(),
    threshold: z.number().nullish(),
    lowerBound: z.number().nullish(),
    upperBound: z.number().nullish(),
  })
);

export const createCodeEvaluatorInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        sourceCode: ["source_code"],
        sandboxConfigId: ["sandbox_config_id"],
        inputMapping: ["input_mapping"],
        outputConfig: ["output_config"],
      }),
    z.object({
      name: z.string().min(1),
      sourceCode: z.string().min(1),
      language: languageSchema,
      description: z.string().optional(),
      sandboxConfigId: z.string().nullish(),
      inputMapping: inputMappingSchema.optional(),
      outputConfig: outputConfigSchema.nullish(),
    })
  )
  .transform((value) => ({
    name: value.name,
    sourceCode: value.sourceCode,
    language: value.language,
    description: value.description,
    sandboxConfigId: value.sandboxConfigId ?? null,
    inputMapping: value.inputMapping ?? { pathMapping: {}, literalMapping: {} },
    outputConfig: value.outputConfig ?? null,
  }));
