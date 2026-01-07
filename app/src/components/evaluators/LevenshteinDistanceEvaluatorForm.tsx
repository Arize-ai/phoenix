import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Checkbox,
  ComboBox,
  ComboBoxItem,
  Flex,
  Label,
  Text,
} from "@phoenix/components";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { LevenshteinDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorCodeBlock";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useLevenshteinDistanceEvaluatorForm = () => {
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

export const LevenshteinDistanceEvaluatorForm = () => {
  const { control, getValues } = useLevenshteinDistanceEvaluatorForm();
  const [expectedPath, setExpectedPath] = useState<string>(
    () => getValues("pathMapping.expected") ?? ""
  );
  const [actualPath, setActualPath] = useState<string>(
    () => getValues("pathMapping.actual") ?? ""
  );
  const preMappedInput = useEvaluatorStore((state) => state.preMappedInput);
  const allExampleKeys = useFlattenedEvaluatorInputKeys(preMappedInput);
  return (
    <Flex direction="column" gap="size-200">
      <LevenshteinDistanceEvaluatorCodeBlock />
      <Flex direction="column" gap="size-100">
        <Controller
          name={`pathMapping.expected`}
          control={control}
          render={({ field }) => (
            <ComboBox
              aria-label={`Map an example field to the Expected parameter`}
              placeholder="Map an example field to the Expected parameter"
              defaultItems={allExampleKeys}
              selectedKey={field.value ?? ""}
              label="Expected"
              size="L"
              description={`The expected text. Choose an example field from the list to map to the Expected parameter.`}
              onSelectionChange={(key) => {
                field.onChange(key);
                setExpectedPath(key as string);
              }}
              onInputChange={(value) => setExpectedPath(value)}
              inputValue={expectedPath ?? ""}
              css={css`
                width: 100%;
                min-width: 0 !important;
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
          name={`pathMapping.actual`}
          control={control}
          render={({ field }) => (
            <ComboBox
              aria-label={`Map an example field to the Actual parameter`}
              placeholder="Map an example field to the Actual parameter"
              defaultItems={allExampleKeys}
              selectedKey={field.value ?? ""}
              label="Actual"
              size="L"
              description={`The actual text to compare. Choose an example field from the list to map to the Actual parameter.`}
              onSelectionChange={(key) => {
                field.onChange(key);
                setActualPath(key as string);
              }}
              onInputChange={(value) => setActualPath(value)}
              inputValue={actualPath ?? ""}
              css={css`
                width: 100%;
                min-width: 0 !important;
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
          name="literalMapping.case_sensitive"
          control={control}
          defaultValue={true}
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
                    : true
              )}
            >
              <Label>Case sensitive</Label>
              <Text slot="description">
                Whether comparison is case-sensitive.
              </Text>
            </Checkbox>
          )}
        />
      </Flex>
    </Flex>
  );
};
