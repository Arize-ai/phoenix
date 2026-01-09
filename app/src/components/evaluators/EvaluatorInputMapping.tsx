import { PropsWithChildren, Suspense, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Loading, Text } from "@phoenix/components";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { Flex } from "@phoenix/components/layout/Flex";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorMappingSource } from "@phoenix/types";
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
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(evaluatorMappingSource);
  const inputValues = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  // iterate over all keys in the control
  // each row should have a variable, an arrow pointing to the example field, and a select field
  // the variable should be the key, the select field should have all flattened example keys as options
  return (
    <Flex direction="column" gap="size-100" width="100%">
      {variables.map((variable) => (
        <SwitchableEvaluatorInput
          key={variable}
          fieldName={variable}
          label={variable}
          size="M"
          defaultMode="path"
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder={variable}
          literalPlaceholder="Enter a value"
          pathInputValue={inputValues[variable] ?? ""}
          onPathInputChange={(val) => setValue(`pathMapping.${variable}`, val)}
        />
      ))}
      {variables.length === 0 && (
        <Text color="text-500">
          Variables that you add to your prompt will be available to map here.
        </Text>
      )}
    </Flex>
  );
};

export const useFlattenedEvaluatorInputKeys = (
  evaluatorMappingSource: EvaluatorMappingSource
) => {
  return useMemo(() => {
    const flat = flattenObject({
      obj: evaluatorMappingSource,
      keepNonTerminalValues: true,
      formatIndices: true,
    });
    return Object.keys(flat).map((key) => ({
      id: key,
      label: key,
    }));
  }, [evaluatorMappingSource]);
};
