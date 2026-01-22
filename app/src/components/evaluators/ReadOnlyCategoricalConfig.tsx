import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import { Flex, Input, Label, TextField, Token } from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyCategoricalConfigProps = {
  /**
   * If true, the optimization direction field will be read-only.
   * If false or omitted, it will be editable.
   */
  isReadOnly?: boolean;
};

/**
 * A display component for categorical evaluator output configuration that pulls
 * values from the EvaluatorStore.
 * Displays name as a borderless disabled input and choices as score tokens.
 * Optimization direction can be editable or read-only based on `isReadOnly` prop.
 */
export const ReadOnlyCategoricalConfig = ({
  isReadOnly,
}: ReadOnlyCategoricalConfigProps) => {
  const outputConfig = useEvaluatorStore(
    useShallow((state) => {
      if (state.outputConfig && "values" in state.outputConfig) {
        return state.outputConfig as ClassificationEvaluatorAnnotationConfig;
      }
      return null;
    })
  );

  if (!outputConfig) {
    return null;
  }

  const { name, values } = outputConfig;

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
      <OptimizationDirectionField isReadOnly={isReadOnly} />
    </Flex>
  );
};
