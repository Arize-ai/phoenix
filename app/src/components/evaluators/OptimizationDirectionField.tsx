import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

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
import { EvaluatorOptimizationDirection } from "@phoenix/types";

export const optimizationDirectionOptions: {
  value: EvaluatorOptimizationDirection;
  label: string;
}[] = [
  { value: "MAXIMIZE", label: "Maximize (higher is better)" },
  { value: "MINIMIZE", label: "Minimize (lower is better)" },
  { value: "NONE", label: "None" },
];

const getOptimizationDirectionLabel = (
  value: EvaluatorOptimizationDirection
): string => {
  return (
    optimizationDirectionOptions.find((opt) => opt.value === value)?.label ??
    value
  );
};

export type OptimizationDirectionFieldProps = {
  isReadOnly?: boolean;
  isDisabled?: boolean;
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
}: OptimizationDirectionFieldProps) => {
  const { optimizationDirection, setOutputConfigOptimizationDirection } =
    useEvaluatorStore(
      useShallow((state) => ({
        optimizationDirection:
          state.outputConfigs[0]?.optimizationDirection ?? "NONE",
        setOutputConfigOptimizationDirection:
          state.setOutputConfigOptimizationDirection,
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
    <Select
      value={optimizationDirection}
      onChange={(e) =>
        setOutputConfigOptimizationDirection(
          e as EvaluatorOptimizationDirection
        )
      }
      isDisabled={isDisabled}
      aria-label="Optimization direction"
      data-testid="optimization-direction-picker"
      css={css`
        width: fit-content;
      `}
    >
      <Label>Optimization direction</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {optimizationDirectionOptions.map((option) => (
            <SelectItem key={option.value} id={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
};
