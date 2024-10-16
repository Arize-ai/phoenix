import React from "react";

import { Flex, Slider, TextField } from "@arizeai/components";

import { ModelConfig } from "@phoenix/store";

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
  return (
    <Flex direction="column" gap="size-200">
      <Slider
        label="Temperature"
        value={invocationParameters.temperature || 0}
        step={0.1}
        minValue={0}
        maxValue={2}
        onChange={(value) => onChange("temperature", value)}
      />
      <Slider
        label="Top P"
        value={invocationParameters.topP || 0}
        step={0.1}
        minValue={0}
        maxValue={1}
        onChange={(value) => onChange("topP", value)}
      />
      {/* TODO(apowell): there's likely a better way. Do we maintain a map of provider:model to form field overrides? */}
      {modelName?.startsWith("o1") && provider === "OPENAI" ? (
        <TextField
          label="Max Completion Tokens"
          value={invocationParameters.maxCompletionTokens?.toString() || ""}
          type="number"
          onChange={(value) => onChange("maxCompletionTokens", Number(value))}
          description="The maximum number of tokens to generate"
        />
      ) : (
        <TextField
          label="Max Tokens"
          value={invocationParameters.maxTokens?.toString() || ""}
          type="number"
          onChange={(value) => onChange("maxTokens", Number(value))}
          description="The maximum number of tokens to generate"
        />
      )}
      {/* TODO(apowell): Combobox / Tag input? Bespoke add/remove menu? */}
      <TextField
        label="Stop"
        defaultValue={invocationParameters.stop?.join(", ") || ""}
        onChange={(value) => onChange("stop", value.split(/, */g))}
        description="Comma-separated list of tokens to stop on"
      />
      <TextField
        label="Seed"
        value={invocationParameters.seed?.toString() || ""}
        type="number"
        onChange={(value) => onChange("seed", Number(value))}
        description="Any integer that can be reused to produce semi-deterministic outputs"
      />
    </Flex>
  );
};
