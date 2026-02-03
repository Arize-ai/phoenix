import { PropsWithChildren, Suspense, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Loading, Text } from "@phoenix/components";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  escapeFieldNameForReactHookForm,
  unescapeFieldNameFromReactHookForm,
} from "@phoenix/components/evaluators/fieldNameUtils";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { Flex } from "@phoenix/components/layout/Flex";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorMappingSource } from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

/**
 * Escapes all keys in a mapping object for use with react-hook-form.
 * This prevents dots in keys from being interpreted as nested paths.
 */
function escapeMapping<T>(mapping: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(mapping)) {
    result[escapeFieldNameForReactHookForm(key)] = value;
  }
  return result;
}

/**
 * Unescapes all keys in a mapping object after reading from react-hook-form.
 * This converts the escaped keys back to their original form with dots.
 */
function unescapeMapping<T>(mapping: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(mapping)) {
    result[unescapeFieldNameFromReactHookForm(key)] = value;
  }
  return result;
}

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
  // Escape keys for react-hook-form to prevent dots from being interpreted as nested paths
  const escapedPathMapping = useMemo(
    () => escapeMapping(pathMapping),
    [pathMapping]
  );
  const escapedLiteralMapping = useMemo(
    () => escapeMapping(literalMapping),
    [literalMapping]
  );
  const form = useForm({
    defaultValues: {
      pathMapping: escapedPathMapping,
      literalMapping: escapedLiteralMapping,
    },
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
        // Unescape keys when writing back to store
        setPathMapping({ ...unescapeMapping(pathMapping) });
        setLiteralMapping({ ...unescapeMapping(literalMapping) });
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
      {variables.map((variable) => {
        // Escape the variable name for use with react-hook-form
        const escapedVariable = escapeFieldNameForReactHookForm(variable);
        return (
          <SwitchableEvaluatorInput
            key={variable}
            fieldName={escapedVariable}
            label={variable}
            size="M"
            defaultMode="path"
            control={control}
            setValue={setValue}
            pathOptions={allExampleKeys}
            pathPlaceholder={variable}
            literalPlaceholder="Enter a value"
            pathInputValue={inputValues[variable] ?? ""}
            onPathInputChange={(val) =>
              setValue(`pathMapping.${escapedVariable}`, val)
            }
          />
        );
      })}
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
