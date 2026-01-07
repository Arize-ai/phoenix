import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { ComboBox, ComboBoxItem, Flex } from "@phoenix/components";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useJSONDistanceEvaluatorForm = () => {
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

export const JSONDistanceEvaluatorForm = () => {
  const { control, getValues } = useJSONDistanceEvaluatorForm();
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
      <JSONDistanceEvaluatorCodeBlock />
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
              description={`The expected JSON string. Choose an example field from the list to map to the Expected parameter.`}
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
              description={`The actual JSON string to compare. Choose an example field from the list to map to the Actual parameter.`}
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
      </Flex>
    </Flex>
  );
};
