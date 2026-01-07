import { PropsWithChildren, Suspense, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Icon, Icons, Loading, Text } from "@phoenix/components";
import { Heading } from "@phoenix/components/content/Heading";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
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

const EvaluatorInputMappingControls = () => {
  const { control, setValue } = useEvaluatorInputMappingControlsForm();
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
          <SwitchableEvaluatorInput
            fieldName={variable}
            label={variable}
            size="S"
            defaultMode="path"
            control={control}
            setValue={setValue}
            pathOptions={allExampleKeys}
            pathPlaceholder="Select an example field"
            literalPlaceholder="Enter a value"
            pathInputValue={inputValues[variable] ?? ""}
            onPathInputChange={(val) =>
              setValue(`pathMapping.${variable}`, val)
            }
            hideLabel
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
      formatIndices: true,
    });
    return Object.keys(flat).map((key) => ({
      id: key,
      label: key,
    }));
  }, [evaluatorPreMappedInput]);
};
