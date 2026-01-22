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
import { EvaluatorOptimizationDirection } from "@phoenix/types";

const optimizationDirectionOptions: {
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
  value: EvaluatorOptimizationDirection;
  onChange?: (value: EvaluatorOptimizationDirection) => void;
  isDisabled?: boolean;
};

/**
 * A field component for optimization direction that can be editable or read-only.
 *
 * - If `onChange` is provided, renders an editable `Select` dropdown
 * - If `onChange` is omitted, renders read-only `Text` with a friendly label
 */
export const OptimizationDirectionField = ({
  value,
  onChange,
  isDisabled,
}: OptimizationDirectionFieldProps) => {
  if (!onChange) {
    return (
      <Flex direction="column" gap="size-50">
        <Label>Optimization direction</Label>
        <Text>{getOptimizationDirectionLabel(value)}</Text>
      </Flex>
    );
  }

  return (
    <Select
      value={value}
      onChange={(e) => onChange?.(e as EvaluatorOptimizationDirection)}
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
