import { PropsWithChildren } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  Text,
  TextField,
} from "@phoenix/components";
import type { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorOptimizationDirection } from "@phoenix/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const optimizationDirections = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
] satisfies EvaluatorOptimizationDirection[];

type EvaluatorLLMChoiceProps = {
  control: Control<EvaluatorFormValues, unknown>;
};

export const EvaluatorLLMChoice = ({ control }: EvaluatorLLMChoiceProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "choiceConfig.choices",
  });
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
        <Controller
          control={control}
          name="choiceConfig.name"
          rules={{
            required: "Name is required",
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField {...field} isInvalid={!!error}>
              <Label>Name</Label>
              <Input placeholder="e.g. correctness" />
              <FieldError>{error?.message}</FieldError>
            </TextField>
          )}
        />
        <Controller
          control={control}
          name="choiceConfig.optimizationDirection"
          render={({ field }) => (
            <RadioGroup
              {...field}
              aria-label="Optimization Direction"
              data-testid="optimization-direction-picker"
              css={css`
                height: 100%;
              `}
            >
              <Label>Optimization Direction</Label>
              {optimizationDirections.map((direction) => (
                <Radio key={direction} value={direction}>
                  {direction.charAt(0).toUpperCase() +
                    direction.slice(1).toLowerCase()}
                </Radio>
              ))}
              <Text marginTop="auto" slot="description">
                Maximize - higher the score the better - e.g., correctness
                <br />
                Minimize - lower the score the better - e.g., hallucinations
                <br />
                None - higher is not better or worse
                <br />
              </Text>
            </RadioGroup>
          )}
        />
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
                name={`choiceConfig.choices.${index}.label`}
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
                  name={`choiceConfig.choices.${index}.score`}
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
