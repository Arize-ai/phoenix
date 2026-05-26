import { z } from "zod";

import { outputConfigDraftSchema } from "@phoenix/agent/tools/codeEvaluatorDraft/schemas";
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

export const createCodeEvaluatorInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        sourceCode: ["source_code"],
        sandboxConfigId: ["sandbox_config_id"],
        inputMapping: ["input_mapping"],
        outputConfigs: ["output_configs"],
      }),
    z.object({
      name: z.string().min(1),
      sourceCode: z.string().min(1),
      language: languageSchema,
      description: z.string().optional(),
      sandboxConfigId: z.string().min(1),
      inputMapping: inputMappingSchema.optional(),
      outputConfigs: z.array(outputConfigDraftSchema).optional(),
    })
  )
  .transform((value) => ({
    name: value.name,
    sourceCode: value.sourceCode,
    language: value.language,
    description: value.description,
    sandboxConfigId: value.sandboxConfigId,
    inputMapping: value.inputMapping ?? { pathMapping: {}, literalMapping: {} },
    outputConfigs: value.outputConfigs ?? [],
  }));
