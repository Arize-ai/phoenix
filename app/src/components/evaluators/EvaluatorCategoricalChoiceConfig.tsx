import { PropsWithChildren, useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { EvaluatorOptimizationDirection } from "@phoenix/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const optimizationDirectionOptions: {
  value: EvaluatorOptimizationDirection;
  label: string;
}[] = [
  { value: "MAXIMIZE", label: "Maximize (higher is better)" },
  { value: "MINIMIZE", label: "Minimize (lower is better)" },
  { value: "NONE", label: "None" },
];

const useEvaluatorLLMChoiceForm = () => {
  // pull in zustand
  const store = useEvaluatorStoreInstance();
  const { outputConfig, includeExplanation } = useEvaluatorStore(
    useShallow((state) => ({
      // only allow categorical annotation configs
      outputConfig:
        state.outputConfig && "values" in state.outputConfig
          ? state.outputConfig
          : undefined,
      includeExplanation: state.evaluator.includeExplanation,
    }))
  );
  invariant(
    outputConfig,
    "outputConfig is required. Mount EvaluatorCategoricalChoiceConfig within an LLM Evaluator."
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
        if (!("values" in outputConfig)) {
          return;
        }
        const {
          setOutputConfigOptimizationDirection,
          setOutputConfigValues,
          setIncludeExplanation,
        } = store.getState();
        setOutputConfigOptimizationDirection(
          outputConfig.optimizationDirection
        );
        setOutputConfigValues(outputConfig.values);
        setIncludeExplanation(includeExplanation);
      },
    });
  }, [subscribe, store]);

  return form;
};

export const EvaluatorCategoricalChoiceConfig = () => {
  const { control } = useEvaluatorLLMChoiceForm();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "outputConfig.values",
  });
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
          <TextField isDisabled value={outputConfigName}>
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
        <Flex direction="column" gap="size-100">
          <GridRow>
            <Text>Choice</Text>
            <Text>Score</Text>
          </GridRow>
          {/* render choices. you must have at least 2 choices, you cannot delete if there are only two remaining */}
          {fields.map((item, index) => (
            <GridRow key={item.id}>
              <Controller
                control={control}
                name={`outputConfig.values.${index}.label`}
                rules={{
                  required: "Choice label is required",
                }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    aria-label={`Choice ${index + 1}`}
                    isInvalid={!!error}
                    css={css`
                      flex: 1 1 auto;
                      flex-shrink: 1;
                    `}
                  >
                    <Input
                      placeholder={`e.g. ${ALPHABET[index % ALPHABET.length]}`}
                    />
                    <FieldError>{error?.message}</FieldError>
                  </TextField>
                )}
              />
              <Flex direction="row" gap="size-100" alignItems="center">
                <Controller
                  control={control}
                  name={`outputConfig.values.${index}.score`}
                  render={({ field, fieldState: { error } }) => (
                    <NumberField
                      {...field}
                      value={
                        typeof field.value === "number"
                          ? field.value
                          : undefined
                      }
                      aria-label={`Score ${index + 1}`}
                      isInvalid={!!error}
                      css={css`
                        width: 100%;
                      `}
                    >
                      <Input
                        placeholder={`e.g. ${index} (optional)`}
                        // the css field overrides the default input className, add it back
                        className="react-aria-Input"
                        css={css`
                          width: 100%;
                        `}
                      />
                      <FieldError>{error?.message}</FieldError>
                    </NumberField>
                  )}
                />
                {index > 1 && (
                  <Button
                    type="button"
                    leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                    aria-label="Remove choice"
                    onPress={() => {
                      if (fields.length === 2) {
                        return;
                      }
                      remove(index);
                    }}
                  />
                )}
              </Flex>
            </GridRow>
          ))}
          <Flex
            alignItems="center"
            justifyContent="space-between"
            gap="size-200"
          >
            <Controller
              control={control}
              name="includeExplanation"
              render={({ field }) => (
                <Switch isSelected={field.value} onChange={field.onChange}>
                  <Text>Include explanation</Text>
                </Switch>
              )}
            />
            <Button
              type="button"
              size="S"
              variant="quiet"
              css={css`
                width: fit-content;
              `}
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              aria-label="Add choice"
              onPress={() => {
                append({ label: "", score: undefined });
              }}
            >
              Add choice
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};

const GridRow = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        width: 100%;
        display: grid;
        grid-template-columns: 3fr 1fr;
        gap: var(--ac-global-dimension-static-size-100);
        align-items: start;
      `}
    >
      {children}
    </div>
  );
};
