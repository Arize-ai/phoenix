import React from "react";
import { z } from "zod";

import { Flex, Slider, TextField } from "@arizeai/components";

import { ModelConfig } from "@phoenix/store";
import { schemaForType } from "@phoenix/typeUtils";

import { InvocationParameters } from "./__generated__/PlaygroundOutputSubscription.graphql";

/**
 * Model invocation parameters schema in zod.
 *
 * Includes all keys besides toolChoice
 */
const invocationParameterSchema = schemaForType<InvocationParameters>()(
  z.object({
    temperature: z.number().optional(),
    topP: z.number().optional(),
    maxTokens: z.number().optional(),
    stop: z.array(z.string()).optional(),
    seed: z.number().optional(),
    maxCompletionTokens: z.number().optional(),
  })
);

type InvocationParametersSchema = z.infer<typeof invocationParameterSchema>;

/**
 * Default set of invocation parameters for all providers and models.
 */
const baseInvocationParameterSchema = invocationParameterSchema.omit({
  maxCompletionTokens: true,
});

type BaseInvocationParameters = z.infer<typeof baseInvocationParameterSchema>;

/**
 * Invocation parameters for O1 models.
 */
const o1BaseInvocationParameterSchema = baseInvocationParameterSchema
  .extend({
    maxCompletionTokens: z.number().optional(),
  })
  .omit({ maxTokens: true });

/**
 * Provider schemas for all models and optionally for a specific model.
 */
const providerSchemas = {
  OPENAI: {
    default: baseInvocationParameterSchema,
    "o1-preview": o1BaseInvocationParameterSchema,
    "o1-preview-2024-09-12": o1BaseInvocationParameterSchema,
    "o1-mini": o1BaseInvocationParameterSchema,
    "o1-mini-2024-09-12": o1BaseInvocationParameterSchema,
  },
  AZURE_OPENAI: {
    default: baseInvocationParameterSchema,
  },
  ANTHROPIC: {
    default: baseInvocationParameterSchema,
  },
} satisfies Record<
  ModelProvider,
  Record<string, z.ZodType<BaseInvocationParameters>>
>;

/**
 * Form field for a single invocation parameter.
 *
 * TODO(apowell): Should this be generic over the schema field data type? There
 * probably aren't enough fields for that to be worthwhile at the moment.
 */
const FormField = ({
  field,
  value,
  onChange,
}: {
  field: keyof InvocationParametersSchema;
  value: InvocationParametersSchema[keyof InvocationParametersSchema];
  onChange: (
    value: InvocationParametersSchema[keyof InvocationParametersSchema]
  ) => void;
}) => {
  switch (field) {
    case "temperature":
      if (typeof value !== "number" && value !== undefined) return null;
      return (
        <Slider
          label="Temperature"
          value={value}
          step={0.1}
          minValue={0}
          maxValue={2}
          onChange={(value) => onChange(value)}
        />
      );
    case "topP":
      if (typeof value !== "number" && value !== undefined) return null;
      return (
        <Slider
          label="Top P"
          value={value}
          step={0.1}
          minValue={0}
          maxValue={1}
          onChange={(value) => onChange(value)}
        />
      );
    case "maxCompletionTokens":
      return (
        <TextField
          label="Max Completion Tokens"
          value={value?.toString() || ""}
          type="number"
          onChange={(value) => onChange(Number(value))}
        />
      );
    case "maxTokens":
      return (
        <TextField
          label="Max Tokens"
          value={value?.toString() || ""}
          type="number"
          onChange={(value) => onChange(Number(value))}
        />
      );
    case "stop":
      if (!Array.isArray(value) && value !== undefined) return null;
      return (
        <TextField
          label="Stop"
          defaultValue={value?.join(", ") || ""}
          onChange={(value) => onChange(value.split(/, */g))}
        />
      );
    case "seed":
      return (
        <TextField
          label="Seed"
          value={value?.toString() || ""}
          type="number"
          onChange={(value) => onChange(Number(value))}
        />
      );
    default:
      return null;
  }
};

export type InvocationParametersChangeHandler = <
  T extends keyof ModelConfig["invocationParameters"],
>(
  parameter: T,
  value: ModelConfig["invocationParameters"][T]
) => void;

type InvocationParametersFormProps = {
  model: ModelConfig;
  onChange: InvocationParametersChangeHandler;
};

export const InvocationParametersForm = ({
  model,
  onChange,
}: InvocationParametersFormProps) => {
  const { invocationParameters, provider, modelName } = model;
  // Get the schema for the incoming provider and model combination.
  const schema =
    providerSchemas?.[provider]?.[
      (modelName || "default") as keyof (typeof providerSchemas)[ModelProvider]
    ] ?? providerSchemas[provider].default;

  // TODO(apowell): Should we instead fail open here and display all inputs?
  const valid = schema.safeParse(invocationParameters);
  if (!valid.success) {
    return null;
  }
  // Generate form fields for all invocation parameters, constrained by the schema.
  const parameters = valid.data;
  const fieldsForSchema = Object.keys(schema.shape).map((field) => {
    const fieldKey = field as keyof typeof parameters;
    return (
      <FormField
        key={fieldKey}
        field={fieldKey}
        value={parameters[fieldKey]}
        onChange={(value) => onChange(fieldKey, value)}
      />
    );
  });
  return (
    <Flex direction="column" gap="size-200">
      {fieldsForSchema}
    </Flex>
  );
};
