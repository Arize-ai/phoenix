import { css } from "@emotion/react";

import { Flex, Input, Label, TextField, Token } from "@phoenix/components";
import { EvaluatorOptimizationDirection } from "@phoenix/types";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyCategoricalConfigProps = {
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  onOptimizationDirectionChange?: (
    value: EvaluatorOptimizationDirection
  ) => void;
  values: Array<{ label?: string | null; score?: number | null }>;
};

/**
 * A read-only display component for categorical evaluator output configuration.
 * Displays name as a borderless disabled input and choices as score tokens,
 * but optimization direction can optionally be editable if `onOptimizationDirectionChange` is provided.
 */
export const ReadOnlyCategoricalConfig = ({
  name,
  optimizationDirection,
  onOptimizationDirectionChange,
  values,
}: ReadOnlyCategoricalConfigProps) => {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-200" alignItems="last baseline">
        <TextField
          isDisabled
          value={name}
          css={css`
            width: fit-content;
          `}
        >
          <Label>Name</Label>
          <Input />
        </TextField>
        <Flex direction="row" gap="size-100" alignItems="end">
          {values.map((value, index) => {
            const hasLabel = value.label != null && value.label !== "";
            const hasScore = value.score != null;
            // Format: "label, score: X" or just "score: X"
            const tokenContent = hasLabel
              ? hasScore
                ? `${value.label}, score: ${value.score}`
                : value.label
              : hasScore
                ? `score: ${value.score}`
                : "";
            return <Token key={index}>{tokenContent}</Token>;
          })}
        </Flex>
      </Flex>
      <OptimizationDirectionField
        value={optimizationDirection}
        onChange={onOptimizationDirectionChange}
      />
    </Flex>
  );
};
