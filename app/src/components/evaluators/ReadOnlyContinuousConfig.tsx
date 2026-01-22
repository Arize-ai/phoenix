import { css } from "@emotion/react";

import {
  Flex,
  Input,
  Label,
  NumberField,
  TextField,
} from "@phoenix/components";
import { EvaluatorOptimizationDirection } from "@phoenix/types";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyContinuousConfigProps = {
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  onOptimizationDirectionChange?: (
    value: EvaluatorOptimizationDirection
  ) => void;
  lowerBound?: number | null;
  upperBound?: number | null;
};

/**
 * A read-only display component for continuous evaluator output configuration.
 * Displays name and bounds as borderless disabled inputs, but optimization direction can
 * optionally be editable if `onOptimizationDirectionChange` is provided.
 */
export const ReadOnlyContinuousConfig = ({
  name,
  optimizationDirection,
  onOptimizationDirectionChange,
  lowerBound,
  upperBound,
}: ReadOnlyContinuousConfigProps) => {
  const hasLowerBound = lowerBound != null;
  const hasUpperBound = upperBound != null;
  const hasBounds = hasLowerBound || hasUpperBound;

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-200" alignItems="end">
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
        {hasBounds && (
          <Flex direction="row" gap="size-200" alignItems="end">
            <NumberField
              isDisabled
              value={lowerBound ?? undefined}
              css={css`
                width: fit-content;
              `}
            >
              <Label>Lower bound</Label>
              <Input placeholder={hasLowerBound ? undefined : "unbounded"} />
            </NumberField>
            <NumberField
              isDisabled
              value={upperBound ?? undefined}
              css={css`
                width: fit-content;
              `}
            >
              <Label>Upper bound</Label>
              <Input placeholder={hasUpperBound ? undefined : "unbounded"} />
            </NumberField>
          </Flex>
        )}
      </Flex>
      <OptimizationDirectionField
        value={optimizationDirection}
        onChange={onOptimizationDirectionChange}
      />
    </Flex>
  );
};
