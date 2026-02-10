import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import {
  Flex,
  Input,
  Label,
  NumberField,
  TextField,
} from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { ContinuousEvaluatorAnnotationConfig } from "@phoenix/types";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyContinuousConfigProps = {
  /**
   * If true, the optimization direction field will be read-only.
   * If false or omitted, it will be editable.
   */
  isReadOnly?: boolean;
};

/**
 * A display component for continuous evaluator output configuration that pulls
 * values from the EvaluatorStore.
 * Displays name and bounds as borderless disabled inputs.
 * Optimization direction can be editable or read-only based on `isReadOnly` prop.
 */
export const ReadOnlyContinuousConfig = ({
  isReadOnly,
}: ReadOnlyContinuousConfigProps) => {
  const outputConfig = useEvaluatorStore(
    useShallow((state) => {
      const firstConfig = state.outputConfigs[0];
      if (firstConfig && !("values" in firstConfig)) {
        return firstConfig as ContinuousEvaluatorAnnotationConfig;
      }
      return null;
    })
  );

  if (!outputConfig) {
    return null;
  }

  const { name, lowerBound, upperBound } = outputConfig;
  const hasLowerBound = lowerBound != null;
  const hasUpperBound = upperBound != null;
  const hasBounds = hasLowerBound || hasUpperBound;

  return (
    <div
      css={css`
        background-color: var(--ac-global-background-color-dark);
        border-radius: var(--ac-global-rounding-medium);
        padding: var(--ac-global-dimension-static-size-200);
        margin-top: var(--ac-global-dimension-static-size-50);
        border: 1px solid var(--ac-global-border-color-default);
      `}
    >
      <Flex direction="column" gap="size-200">
        <Flex alignItems="center" justifyContent="space-between" gap="size-200">
          <TextField isDisabled value={name}>
            <Label>Name</Label>
            <Input />
          </TextField>
          <OptimizationDirectionField isReadOnly={isReadOnly} />
        </Flex>
        {hasBounds && (
          <Flex direction="row" gap="size-200" alignItems="end">
            <NumberField isDisabled value={lowerBound ?? undefined}>
              <Label>Lower bound</Label>
              <Input placeholder={hasLowerBound ? undefined : "unbounded"} />
            </NumberField>
            <NumberField isDisabled value={upperBound ?? undefined}>
              <Label>Upper bound</Label>
              <Input placeholder={hasUpperBound ? undefined : "unbounded"} />
            </NumberField>
          </Flex>
        )}
      </Flex>
    </div>
  );
};
