import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt/schemas";
import { ModelProviders } from "@phoenix/constants/generativeConstants";

export const listPlaygroundModelTargetsInputSchema = z
  .preprocess((input) => (input == null ? {} : input), z.object({}).strict())
  .transform(() => ({}));

const modelProviderSchema = z.custom<ModelProvider>(
  (provider) => typeof provider === "string" && provider in ModelProviders,
  { message: "Invalid model provider." }
);

const builtinModelTargetSchema = z.object({
  type: z.literal("builtin"),
  provider: modelProviderSchema,
  modelName: z.string().min(1),
});

const customModelTargetSchema = z.object({
  type: z.literal("custom"),
  customProviderId: z.string().min(1),
  modelName: z.string().min(1),
});

const setPlaygroundModelTargetSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      customProviderId: ["custom_provider_id"],
      modelName: ["model_name"],
    }),
  z.discriminatedUnion("type", [
    builtinModelTargetSchema,
    customModelTargetSchema,
  ])
);

export const setPlaygroundModelInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        instanceId: ["instance_id"],
      }),
    z.object({
      instanceId: z.number().int().optional(),
      target: setPlaygroundModelTargetSchema,
    })
  )
  .transform(({ instanceId, target }) => ({
    ...(typeof instanceId === "number" ? { instanceId } : {}),
    target,
  }));
