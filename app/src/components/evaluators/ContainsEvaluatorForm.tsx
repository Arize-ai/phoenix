import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Checkbox,
  ComboBox,
  ComboBoxItem,
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
} from "@phoenix/components";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useContainsEvaluatorForm = () => {
  const store = useEvaluatorStoreInstance();
  const { pathMapping, literalMapping } = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const form = useForm({
    defaultValues: { pathMapping, literalMapping },
    mode: "onChange",
  });
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { pathMapping, literalMapping }, isValid }) {
        if (!isValid) {
          return;
        }
        const { setPathMapping, setLiteralMapping } = store.getState();
        setPathMapping({ ...pathMapping });
        setLiteralMapping({ ...literalMapping });
      },
    });
  }, [subscribe, store]);
  return form;
};

export const ContainsEvaluatorForm = () => {
  const { control, getValues } = useContainsEvaluatorForm();
  const [containsTextPath, setContainsTextPath] = useState<string>(
    () => getValues("pathMapping.text") ?? ""
  );
  const preMappedInput = useEvaluatorStore((state) => state.preMappedInput);
  const allExampleKeys = useFlattenedEvaluatorInputKeys(preMappedInput);
  return (
    <Flex direction="column" gap="size-200">
      <ContainsEvaluatorCodeBlock />
      <Flex direction="column" gap="size-100">
        <Controller
          name={`pathMapping.text`}
          control={control}
          render={({ field }) => (
            <ComboBox
              aria-label={`Map an example field to the Text parameter`}
              placeholder="Map an example field to the Text parameter"
              defaultItems={allExampleKeys}
              selectedKey={field.value ?? ""}
              label="Text"
              size="L"
              description={`The text to search for the words in. Choose an example field from the list to map to the Text parameter.`}
              onSelectionChange={(key) => {
                field.onChange(key);
                setContainsTextPath(key as string);
              }}
              onInputChange={(value) => setContainsTextPath(value)}
              inputValue={containsTextPath ?? ""}
              css={css`
                width: 100%;
                min-width: 0 !important;
                // allow the combobox to shrink to prevent blowing up page layout
                .px-combobox-container {
                  min-width: 0 !important;
                  input {
                    min-width: 0 !important;
                  }
                }
              `}
            >
              {(item) => (
                <ComboBoxItem key={item.id} id={item.id} textValue={item.id}>
                  {item.label}
                </ComboBoxItem>
              )}
            </ComboBox>
          )}
        />
        <Controller
          control={control}
          name="literalMapping.words"
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              value={String(field.value ?? "")}
              isInvalid={!!error}
            >
              <Label>Words</Label>
              <Input />
              {!error && (
                <Text slot="description">
                  A comma separated list of words to search for in the text.
                </Text>
              )}
              {error && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
        <Controller
          name="literalMapping.case_sensitive"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Checkbox
              {...field}
              value={String(field.value ?? "")}
              onChange={(value) => field.onChange(value)}
              isSelected={Boolean(
                typeof field.value === "boolean"
                  ? field.value
                  : typeof field.value === "string"
                    ? field.value.toLowerCase() === "true"
                    : false
              )}
            >
              <Label>Case sensitive</Label>
              <Text slot="description">
                Whether to match the words case sensitive.
              </Text>
            </Checkbox>
          )}
        />
      </Flex>
    </Flex>
  );
};
