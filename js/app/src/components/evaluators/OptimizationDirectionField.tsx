import { css } from "@emotion/react";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

export const DEFAULT_OPTIMIZATION_DIRECTION: EvaluatorOptimizationDirection =
  "MAXIMIZE";

export type OptimizationDirectionOption = {
  value: EvaluatorOptimizationDirection;
  label: string;
};

const optimizationDirectionOptions: readonly OptimizationDirectionOption[] = [
  { value: "MAXIMIZE", label: "Maximize (higher is better)" },
  { value: "MINIMIZE", label: "Minimize (lower is better)" },
  { value: "NONE", label: "None" },
];

/**
 * The same three directions, worded for a Yes / No question, whose score is
 * the probability of true: maximizing it means true is the good answer.
 */
export const PREDICATE_OPTIMIZATION_DIRECTION_OPTIONS: readonly OptimizationDirectionOption[] =
  [
    { value: "MAXIMIZE", label: "True is good" },
    { value: "MINIMIZE", label: "False is good" },
    { value: "NONE", label: "Neither" },
  ];

export const PREDICATE_OPTIMIZATION_DIRECTION_DESCRIPTION =
  "Marks which answer is good. It doesn't change the answer or its probability.";

const getOptimizationDirectionLabel = (
  value: EvaluatorOptimizationDirection
): string => {
  return (
    optimizationDirectionOptions.find((opt) => opt.value === value)?.label ??
    value
  );
};

type OptimizationDirectionSelectProps = {
  value: EvaluatorOptimizationDirection;
  onChange: (value: EvaluatorOptimizationDirection) => void;
  isDisabled?: boolean;
  /** Helper text rendered beneath the field via the `description` slot. */
  description?: string;
  /** The choices and their wording; the generic maximize / minimize by default. */
  options?: readonly OptimizationDirectionOption[];
  "aria-label"?: string;
  "data-testid"?: string;
};

/**
 * The optimization direction select every evaluator annotation editor draws:
 * a labelled `Select` of the three directions that fills its row.
 */
export function OptimizationDirectionSelect({
  value,
  onChange,
  isDisabled,
  description,
  options = optimizationDirectionOptions,
  "aria-label": ariaLabel = "Optimization direction",
  "data-testid": testId = "optimization-direction-picker",
}: OptimizationDirectionSelectProps) {
  return (
    <Select
      data-testid={testId}
      value={value}
      onChange={(key) => onChange(key as EvaluatorOptimizationDirection)}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
      css={css`
        width: 100%;
      `}
    >
      <Label>Optimization direction</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {options.map((option) => (
            <SelectItem key={option.value} id={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
      {description ? <Text slot="description">{description}</Text> : null}
    </Select>
  );
}

export type OptimizationDirectionFieldProps = {
  isReadOnly?: boolean;
  isDisabled?: boolean;
  /**
   * Optional helper text rendered via React Aria's `description` slot,
   * shown beneath the field when editable.
   */
  description?: string;
  onChange?: () => void;
};

/**
 * A field component for optimization direction that pulls values from the EvaluatorStore.
 *
 * - If `isReadOnly` is true, renders read-only `Text` with a friendly label
 * - Otherwise, renders an editable `Select` dropdown
 */
export const OptimizationDirectionField = ({
  isReadOnly,
  isDisabled,
  description,
  onChange,
}: OptimizationDirectionFieldProps) => {
  const { optimizationDirection, setOutputConfigOptimizationDirectionAtIndex } =
    useEvaluatorStore(
      useShallow((state) => ({
        optimizationDirection:
          state.outputConfigs[0]?.optimizationDirection ?? "NONE",
        setOutputConfigOptimizationDirectionAtIndex:
          state.setOutputConfigOptimizationDirectionAtIndex,
      }))
    );

  if (isReadOnly) {
    return (
      <Flex direction="column" gap="size-50">
        <Label>Optimization direction</Label>
        <Text>{getOptimizationDirectionLabel(optimizationDirection)}</Text>
      </Flex>
    );
  }

  return (
    <OptimizationDirectionSelect
      value={optimizationDirection}
      onChange={(direction) => {
        onChange?.();
        setOutputConfigOptimizationDirectionAtIndex(0, direction);
      }}
      isDisabled={isDisabled}
      description={description}
    />
  );
};
