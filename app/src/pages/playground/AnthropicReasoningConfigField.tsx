import { useRef, useState } from "react";
import { z } from "zod";

import { Switch } from "@arizeai/components";

import { Input, Label, NumberField, Text } from "@phoenix/components";

const MINIMUM_BUDGET_TOKENS = 1024;

const thinkingSchema = z.object({
  type: z.literal("enabled"),
  budget_tokens: z.number().min(MINIMUM_BUDGET_TOKENS),
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
        budget_tokens: lastBudgetTokens.current || MINIMUM_BUDGET_TOKENS,
      });
    } else {
      onChange(null);
    }
  };

  const handleBudgetTokensChange = (value: number | undefined) => {
    const hasBudget = value != null && !isNaN(value);
    lastBudgetTokens.current = hasBudget ? value : MINIMUM_BUDGET_TOKENS;
    onChange({
      type: "enabled",
      budget_tokens: lastBudgetTokens.current,
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
          isRequired={true}
          defaultValue={MINIMUM_BUDGET_TOKENS}
          minValue={MINIMUM_BUDGET_TOKENS}
        >
          <Label>Budget Tokens</Label>
          <Input />
          <Text slot="description">
            Determines how many tokens Claude can use for its internal reasoning
            process. Must be ≥1024 and less than max_tokens.
          </Text>
        </NumberField>
      )}
    </>
  );
};
