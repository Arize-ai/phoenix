import { PropsWithChildren, Suspense, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  ComboBox,
  ComboBoxItem,
  Icon,
  Icons,
  Loading,
  Text,
} from "@phoenix/components";
import { Heading } from "@phoenix/components/content/Heading";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { Flex } from "@phoenix/components/layout/Flex";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorPreMappedInput } from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

export const EvaluatorInputMapping = () => {
  return (
    <EvaluatorInputMappingTitle>
      <Suspense fallback={<Loading />}>
        <EvaluatorInputMappingControls />
      </Suspense>
    </EvaluatorInputMappingTitle>
  );
};

const EvaluatorInputMappingTitle = ({ children }: PropsWithChildren) => {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={3}>Map fields</Heading>
      <Text color="text-500">
        Your evaluator requires certain fields to be available in its input. Map
        these fields to those available in its context.
      </Text>
      {children}
    </Flex>
  );
};

const useEvaluatorInputMappingControlsForm = () => {
  const store = useEvaluatorStoreInstance();
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  const form = useForm({ defaultValues: { pathMapping }, mode: "onChange" });
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { pathMapping }, isValid }) {
        if (!isValid) {
          return;
        }
        const { setPathMapping } = store.getState();
        setPathMapping({ ...pathMapping });
      },
    });
  }, [subscribe, store]);
  return form;
};

const EvaluatorInputMappingControls = () => {
  const { control } = useEvaluatorInputMappingControlsForm();
  const variables = useEvaluatorInputVariables();
  const evaluatorPreMappedInput = useEvaluatorStore(
    (state) => state.preMappedInput
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(
    evaluatorPreMappedInput
  );
  const inputValues = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  // iterate over all keys in the control
  // each row should have a variable, an arrow pointing to the example field, and a select field
  // the variable should be the key, the select field should have all flattened example keys as options
  return (
    <Flex direction="column" gap="size-100" width="100%">
      {variables.map((variable) => (
        <div
          key={variable}
          css={css`
            display: grid;
            grid-template-columns: 4fr 1fr 4fr;
            gap: var(--ac-global-dimension-static-size-100);
            align-items: center;
            justify-items: center;
            width: 100%;
          `}
        >
          <Controller
            name={`pathMapping.${variable}`}
            control={control}
            render={({ field }) => (
              <ComboBox
                aria-label={`Select an example field for ${variable}`}
                placeholder="Select an example field"
                defaultItems={allExampleKeys}
                selectedKey={field.value ?? ""}
                allowsCustomValue
                onSelectionChange={(key) => {
                  if (!key) {
                    return;
                  }
                  field.onChange(key);
                }}
                onInputChange={(value) => field.onChange(value)}
                inputValue={inputValues[variable] ?? ""}
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
          <Icon svg={<Icons.ArrowRightWithStem />} />
          <Text
            css={css`
              white-space: nowrap;
            `}
            title={variable}
          >
            <Truncate maxWidth="200px">{variable}</Truncate>
          </Text>
        </div>
      ))}
    </Flex>
  );
};

export const useFlattenedEvaluatorInputKeys = (
  evaluatorPreMappedInput: EvaluatorPreMappedInput
) => {
  return useMemo(() => {
    const flat = flattenObject({
      obj: evaluatorPreMappedInput,
      keepNonTerminalValues: true,
    });
    return Object.keys(flat).map((key) => ({
      id: key,
      label: key,
    }));
  }, [evaluatorPreMappedInput]);
};
