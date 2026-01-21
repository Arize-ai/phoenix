import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Input,
  Label,
  ListBox,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  TextField,
} from "@phoenix/components";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { EvaluatorOptimizationDirection } from "@phoenix/types";

const optimizationDirectionOptions: {
  value: EvaluatorOptimizationDirection;
  label: string;
}[] = [
  { value: "MAXIMIZE", label: "Maximize (higher is better)" },
  { value: "MINIMIZE", label: "Minimize (lower is better)" },
  { value: "NONE", label: "None" },
];

const useEvaluatorContinuousConfigForm = () => {
  // pull in zustand
  const store = useEvaluatorStoreInstance();
  const { outputConfig, includeExplanation } = useEvaluatorStore(
    useShallow((state) => ({
      // only allow continuous annotation configs
      outputConfig:
        state.outputConfig && !("values" in state.outputConfig)
          ? state.outputConfig
          : undefined,
      includeExplanation: state.evaluator.includeExplanation,
    }))
  );
  invariant(
    outputConfig,
    "outputConfig is required. Mount EvaluatorContinuousConfig within an LLM Evaluator."
  );
  // make a small react hook form scoped down with validation rules
  const form = useForm({
    defaultValues: { outputConfig, includeExplanation },
    mode: "onChange",
  });
  const subscribe = form.subscribe;
  // watch form fields, push valid updates back to zustand
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { outputConfig, includeExplanation }, isValid }) {
        if (!isValid) {
          return;
        }
        if ("values" in outputConfig) {
          return;
        }
        const { setOutputConfigOptimizationDirection, setIncludeExplanation } =
          store.getState();
        setOutputConfigOptimizationDirection(
          outputConfig.optimizationDirection
        );
        setIncludeExplanation(includeExplanation);
      },
    });
  }, [subscribe, store]);

  return form;
};

export type EvaluatorContinuousConfigProps = {
  isNameDisabled?: boolean;
  isOptimizationDirectionDisabled?: boolean;
  isBoundsDisabled?: boolean;
};

export const EvaluatorContinuousConfig = ({
  isNameDisabled = false,
  isBoundsDisabled = false,
  isOptimizationDirectionDisabled = false,
}: EvaluatorContinuousConfigProps) => {
  const { control } = useEvaluatorContinuousConfigForm();
  const outputConfigName = useEvaluatorStore(
    (state) => state.outputConfig?.name
  );
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
          <TextField isDisabled={isNameDisabled} value={outputConfigName}>
            <Label>Name</Label>
            <Input placeholder="e.g. correctness" />
          </TextField>
          <Controller
            control={control}
            name="outputConfig.optimizationDirection"
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                isDisabled={isOptimizationDirectionDisabled}
                aria-label="Optimization direction"
                data-testid="optimization-direction-picker"
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
                    {optimizationDirectionOptions.map((option) => (
                      <SelectItem key={option.value} id={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
            )}
          />
        </Flex>
        <Flex gap="size-200" width="100%" justifyContent="space-between">
          <Controller
            control={control}
            name="outputConfig.lowerBound"
            render={({ field }) =>
              !isBoundsDisabled || (isBoundsDisabled && field.value != null) ? (
                <NumberField
                  {...field}
                  value={field.value ?? undefined}
                  isDisabled={isBoundsDisabled}
                >
                  <Label>Lower bound</Label>
                  <Input />
                </NumberField>
              ) : (
                <React.Fragment />
              )
            }
          />
          <Controller
            control={control}
            name="outputConfig.upperBound"
            render={({ field }) =>
              !isBoundsDisabled || (isBoundsDisabled && field.value != null) ? (
                <NumberField
                  {...field}
                  value={field.value ?? undefined}
                  isDisabled={isBoundsDisabled}
                >
                  <Label>Upper bound</Label>
                  <Input />
                </NumberField>
              ) : (
                <React.Fragment />
              )
            }
          />
        </Flex>
      </Flex>
    </div>
  );
};
