import React, { useRef, useState } from "react";
import { z } from "zod";

import { Switch } from "@arizeai/components";

import { Input, Label, NumberField, Text } from "@phoenix/components";

const thinkingSchema = z.object({
  type: z.literal("enabled"),
  budget_tokens: z.number().optional(),
});

type AnthropicReasoningConfigFieldProps = {
  onChange: (value: unknown) => void;
  value: unknown;
};

export const AnthropicReasoningConfigField = ({
  onChange,
  value,
}: AnthropicReasoningConfigFieldProps) => {
  const [thinkingBudgetVersion, setThinkingBudgetVersion] = useState(0);
  const validation = thinkingSchema.safeParse(value);
  const configuration = validation.data;
  const lastBudgetTokens = useRef<number | undefined>(
    configuration?.budget_tokens
  );

  const handleEnabledChange = (enabled: boolean) => {
    if (enabled) {
      onChange({
        type: "enabled",
        ...(lastBudgetTokens.current != null
          ? { budget_tokens: lastBudgetTokens.current }
          : {}),
      });
    } else {
      onChange(null);
    }
  };

  const handleBudgetTokensChange = (value: number | undefined) => {
    const hasBudget = value != null && !isNaN(value);
    lastBudgetTokens.current = hasBudget ? value : undefined;
    onChange({
      type: "enabled",
      ...(hasBudget ? { budget_tokens: value } : {}),
    });
    if (!hasBudget) {
      setThinkingBudgetVersion((v) => v + 1);
    }
  };

  return (
    <>
      <Switch
        onChange={handleEnabledChange}
        isSelected={configuration?.type === "enabled"}
      >
        Thinking Enabled
      </Switch>
      {configuration?.type === "enabled" && (
        <NumberField
          key={thinkingBudgetVersion}
          value={configuration?.budget_tokens}
          onChange={handleBudgetTokensChange}
          isDisabled={configuration?.type !== "enabled"}
        >
          <Label>Budget Tokens</Label>
          <Input />
          <Text slot="description">
            (optional) The maximum number of tokens that can be used for
            reasoning.
          </Text>
        </NumberField>
      )}
    </>
  );
};
