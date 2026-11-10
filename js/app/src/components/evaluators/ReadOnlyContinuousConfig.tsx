import { css } from "@emotion/react";
import { useShallow } from "zustand/react/shallow";

import {
  FieldError,
  Flex,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
} from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { ContinuousEvaluatorAnnotationConfig } from "@phoenix/types";
import {
  getContinuousThresholdDescription,
  getContinuousThresholdError,
} from "@phoenix/utils/evaluatorOutputConfigUtils";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyContinuousConfigProps = {
  /**
   * If true, the optimization direction field will be read-only.
   * If false or omitted, it will be editable.
   */
  isReadOnly?: boolean;
  /** Called when the user edits the threshold. */
  onChange?: () => void;
};

/**
 * A display component for continuous evaluator output configuration that pulls
 * values from the EvaluatorStore.
 * Displays name and bounds as borderless disabled inputs. Optimization
 * direction and threshold can be editable or read-only based on `isReadOnly`.
 */
export const ReadOnlyContinuousConfig = ({
  isReadOnly,
  onChange,
}: ReadOnlyContinuousConfigProps) => {
  const setOutputConfigThresholdAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigThresholdAtIndex
  );
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

  const { name, lowerBound, upperBound, optimizationDirection } = outputConfig;
  const threshold = outputConfig.threshold ?? null;
  const thresholdError = getContinuousThresholdError({
    threshold,
    lowerBound,
    upperBound,
  });
  const hasLowerBound = lowerBound != null;
  const hasUpperBound = upperBound != null;
  const hasBounds = hasLowerBound || hasUpperBound;

  return (
    <div
      css={css`
        border-radius: var(--global-rounding-medium);
        padding: var(--global-dimension-size-200);
        margin-top: var(--global-dimension-size-50);
        border: 1px solid var(--global-border-color-default);
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
        <NumberField
          value={threshold ?? undefined}
          isDisabled={isReadOnly}
          isInvalid={thresholdError != null}
          onChange={(value) => {
            onChange?.();
            setOutputConfigThresholdAtIndex(
              0,
              Number.isNaN(value) ? null : value
            );
          }}
          css={css`
            max-width: 50%;
          `}
        >
          <Label>Threshold (optional)</Label>
          <Input
            placeholder={
              lowerBound != null && upperBound != null
                ? String((lowerBound + upperBound) / 2)
                : undefined
            }
          />
          {thresholdError != null ? (
            <FieldError>{thresholdError}</FieldError>
          ) : (
            <Text slot="description">
              {getContinuousThresholdDescription(optimizationDirection)}
            </Text>
          )}
        </NumberField>
      </Flex>
    </div>
  );
};
