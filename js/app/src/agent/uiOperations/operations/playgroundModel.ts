import { z } from "zod";

import { listPlaygroundModelTargetsInputSchema } from "@phoenix/agent/tools/playgroundModel/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/** Route hint shared by every playground operation. */
const PLAYGROUND_ROUTE_HINT =
  "the Prompt Playground page (a /playground route)";

/**
 * Target for selecting a Phoenix built-in model provider.
 *
 * The Python schema (`set_playground_model.py`) computes the `provider` enum
 * at runtime from `phoenix.db.types.model_provider.ModelProvider`, so there
 * is no static list to port here. `provider` is a plain string and the model
 * is directed to `playground.model.list` to discover valid keys; the handler
 * validates the provider against the live playground context.
 */
const builtinModelTargetSchema = z.strictObject({
  type: z
    .literal("builtin")
    .describe("Select a built-in Phoenix model provider."),
  provider: z
    .string()
    .describe(
      "Built-in model provider key, e.g. OPENAI or ANTHROPIC. Call " +
        "`playground.model.list` first to discover the valid provider keys."
    ),
  modelName: z
    .string()
    .describe("The model name to select for the built-in provider."),
});

/** Target for selecting a configured custom model provider. */
const customModelTargetSchema = z.strictObject({
  type: z
    .literal("custom")
    .describe("Select a configured custom model provider."),
  customProviderId: z
    .string()
    .describe("Custom provider ID from the playground context."),
  modelName: z
    .string()
    .describe("The model name to select for the custom provider."),
});

/**
 * Input schema for `playground.model.set`. Ported from the Python JSON
 * schema in
 * `src/phoenix/server/agents/capabilities/tools/external/set_playground_model.py`
 * (the `oneOf` becomes a discriminated union on `type`). Strict to match
 * `additionalProperties: false`.
 */
const setPlaygroundModelInputSchema = z.strictObject({
  instanceId: z
    .number()
    .int()
    .optional()
    .describe(
      "The playground instance ID to update. Omit only when there is exactly " +
        "one playground instance."
    ),
  target: z
    .discriminatedUnion("type", [
      builtinModelTargetSchema,
      customModelTargetSchema,
    ])
    .describe("The model target to select."),
});

export type SetPlaygroundModelOperationInput = z.infer<
  typeof setPlaygroundModelInputSchema
>;

/**
 * The catalog entry replacing the `set_playground_model` client-action tool.
 */
export const setPlaygroundModelOperation = defineUiOperation({
  name: "playground.model.set",
  description:
    "Switch the selected model for one mounted playground instance. This tool " +
    "applies immediately, like the playground model menu. If there is exactly " +
    "one playground instance, `instanceId` may be omitted. If there are " +
    "multiple comparison instances, pass the numeric `instanceId` from the " +
    "playground context. Use `target.type = 'builtin'` for Phoenix built-in " +
    "providers, and `target.type = 'custom'` for a configured custom provider.",
  inputSchema: setPlaygroundModelInputSchema,
  kind: "write",
  defaultSuccessOutput: "Playground model updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `list_playground_model_targets`
 * client-action tool. The input schema is reused from the existing tool
 * module.
 */
export const listPlaygroundModelTargetsOperation = defineUiOperation({
  name: "playground.model.list",
  description:
    "List the model targets currently available in the mounted playground. Use this " +
    "before suggesting playground model options, building model-choice questions, " +
    "or resolving exact provider/model/custom-provider target payloads for " +
    "`playground.model.set`.",
  inputSchema: listPlaygroundModelTargetsInputSchema,
  kind: "read",
  defaultSuccessOutput: "Model targets listed.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground model operations, for catalog assembly. */
export const playgroundModelOperations: UiOperationDescriptor[] = [
  setPlaygroundModelOperation,
  listPlaygroundModelTargetsOperation,
];
