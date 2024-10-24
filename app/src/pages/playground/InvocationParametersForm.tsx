import React from "react";

import { Flex, Slider, TextField } from "@arizeai/components";

import { ModelConfig } from "@phoenix/store";
import { Mutable } from "@phoenix/typeUtils";

import { getInvocationParametersSchema } from "./playgroundUtils";
import { InvocationParametersSchema } from "./schemas";

/**
 * Form field for a single invocation parameter.
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
  const schema = getInvocationParametersSchema({
    modelProvider: provider,
    modelName: modelName || "default",
  });

  const fieldsForSchema = Object.keys(schema.shape).map((field) => {
    const fieldKey = field as keyof (typeof schema)["shape"];
    const value = invocationParameters[fieldKey];
    return (
      <FormField
        key={fieldKey}
        field={fieldKey}
        value={value === null ? undefined : (value as Mutable<typeof value>)}
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
