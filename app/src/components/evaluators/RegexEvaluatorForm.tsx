import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  ComboBox,
  ComboBoxItem,
  Flex,
  Label,
  Switch,
  Text,
} from "@phoenix/components";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { RegexEvaluatorCodeBlock } from "@phoenix/components/evaluators/RegexEvaluatorCodeBlock";
import { RegexField } from "@phoenix/components/RegexField";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useRegexEvaluatorForm = () => {
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

export const RegexEvaluatorForm = () => {
  const { control, getValues } = useRegexEvaluatorForm();
  const [textPath, setTextPath] = useState<string>(
    () => getValues("pathMapping.text") ?? ""
  );
  const preMappedInput = useEvaluatorStore((state) => state.preMappedInput);
  const allExampleKeys = useFlattenedEvaluatorInputKeys(preMappedInput);
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-100">
        <Controller
          control={control}
          name="literalMapping.pattern"
          render={({ field, fieldState: { error } }) => (
            <RegexField
              {...field}
              value={String(field.value ?? "")}
              isInvalid={!!error}
              error={error?.message}
              description="The regex pattern to match against the text. e.g. ^[0-9]+$"
              label="Pattern*"
              placeholder="e.g. ^[0-9]+$"
            />
          )}
        />
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
              description={`The text to search. Choose an example field from the list to map to the Text parameter.`}
              onSelectionChange={(key) => {
                field.onChange(key);
                setTextPath(key as string);
              }}
              onInputChange={(value) => setTextPath(value)}
              inputValue={textPath ?? ""}
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
          name="literalMapping.full_match"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Switch
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
              <Label>Full match</Label>
              <Text slot="description">
                If true, pattern must match entire text; if false, searches for
                pattern anywhere.
              </Text>
            </Switch>
          )}
        />
      </Flex>
      <RegexEvaluatorCodeBlock />
    </Flex>
  );
};
