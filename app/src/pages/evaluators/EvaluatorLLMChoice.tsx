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
  Text,
  TextField,
} from "@phoenix/components";

type Choice = {
  label: string;
  score: number;
};

export type ChoiceConfig = {
  name: string;
  choices: [Choice, Choice, ...Choice[]];
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type EvaluatorLLMChoiceProps = {
  control: Control<ChoiceConfig, unknown, ChoiceConfig>;
};

export const EvaluatorLLMChoice = ({ control }: EvaluatorLLMChoiceProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "choices",
  });
  return (
    <div
      css={css`
        background-color: var(--ac-global-background-color-dark);
        border-radius: var(--ac-global-rounding-medium);
        padding: var(--ac-global-dimension-static-size-200);
        border: 1px solid var(--ac-global-border-color-default);
      `}
    >
      <Flex direction="column" gap="size-200">
        <Controller
          control={control}
          name="name"
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
        <Flex direction="column" gap="size-100">
          <GridRow>
            <Text>Score</Text>
            <Text>Choice</Text>
          </GridRow>
          {/* render choices. you must have at least 2 choices, you cannot delete if there are only two remaining */}
          {fields.map((item, index) => (
            <GridRow key={item.id}>
              <Controller
                control={control}
                name={`choices.${index}.score`}
                render={({ field, fieldState: { error } }) => (
                  <NumberField
                    {...field}
                    value={
                      typeof field.value === "number" ? field.value : undefined
                    }
                    aria-label={`Score ${index + 1}`}
                    isInvalid={!!error}
                    css={css`
                      width: 8ch;
                    `}
                  >
                    <Input
                      placeholder={`e.g. ${index} (optional)`}
                      css={css`
                        width: 100%;
                      `}
                    />
                    <FieldError>{error?.message}</FieldError>
                  </NumberField>
                )}
              />
              <Flex direction="row" gap="size-100" alignItems="center">
                <Controller
                  control={control}
                  name={`choices.${index}.label`}
                  rules={{
                    required: "Choice label is required",
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      {...field}
                      aria-label={`Choice ${index + 1}`}
                      isInvalid={!!error}
                      autoFocus={index > 0}
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
            variant="quiet"
            css={css`
              width: fit-content;
            `}
            leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
            aria-label="Add choice"
            onPress={() => {
              append({ label: "", score: fields.length });
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
        display: grid;
        grid-template-columns: 8ch 1fr;
        gap: var(--ac-global-dimension-static-size-100);
        align-items: start;
      `}
    >
      {children}
    </div>
  );
};
