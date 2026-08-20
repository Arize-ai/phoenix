import type { PropsWithChildren } from "react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";

import { Loading, Text } from "@phoenix/components";
import { Flex } from "@phoenix/components/core/layout/Flex";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  escapeFieldNameForReactHookForm,
  unescapeFieldNameFromReactHookForm,
} from "@phoenix/components/evaluators/fieldNameUtils";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorMappingSourceState } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping as EvaluatorInputMappingValue } from "@phoenix/types";
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

/**
 * A react-hook-form instance over the evaluator's input mapping, kept in sync
 * with the evaluator store.
 *
 * @param pruneEmptyEntries - Drops entries with no value before writing back,
 *   so a control the author left alone stores nothing. Fixed-row editors need
 *   this, because their controls register whether or not they are filled in.
 * @param filterInitialMapping - Narrows what the form starts from. The form
 *   reads the store once, so anything it should not carry forward has to be
 *   dropped here rather than after mount.
 */
export const useEvaluatorInputMappingControlsForm = ({
  pruneEmptyEntries = false,
  filterInitialMapping,
}: {
  pruneEmptyEntries?: boolean;
  filterInitialMapping?: (
    inputMapping: EvaluatorInputMappingValue
  ) => EvaluatorInputMappingValue;
} = {}) => {
  const store = useEvaluatorStoreInstance();
  // Initialize RHF from the store once. Subscribing this component to the same
  // mapping values it writes causes controlled input focus/caret churn.
  const initialInputMappingRef = useRef(
    filterInitialMapping
      ? filterInitialMapping(store.getState().evaluator.inputMapping)
      : store.getState().evaluator.inputMapping
  );
  const { pathMapping, literalMapping } = initialInputMappingRef.current;
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
        const write = <T,>(mapping: Record<string, T>) => {
          const unescaped = unescapeMapping(mapping);
          return pruneEmptyEntries ? pruneEmpty(unescaped) : { ...unescaped };
        };
        setPathMapping(write(pathMapping));
        setLiteralMapping(write(literalMapping));
      },
    });
  }, [subscribe, store, pruneEmptyEntries]);
  return form;
};

/** A control that was never filled in reports an empty value, not an entry. */
function pruneEmpty<T>(mapping: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(mapping).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

const EvaluatorInputMappingControls = () => {
  const { control, setValue } = useEvaluatorInputMappingControlsForm();
  const variables = useEvaluatorInputVariables();
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys({
    evaluatorMappingSource,
  });
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
          />
        );
      })}
      {variables.length === 0 && (
        <Text color="text-500">
          Add variables to your prompt to map them here.
        </Text>
      )}
    </Flex>
  );
};

export const useFlattenedEvaluatorInputKeys = ({
  evaluatorMappingSource,
}: {
  evaluatorMappingSource: EvaluatorMappingSourceState;
}) => {
  const flat = flattenObject({
    obj: evaluatorMappingSource.source,
    keepNonTerminalValues: true,
    formatIndices: true,
    bracketNonIdentifierKeys: true,
  });
  return Object.keys(flat).map((key) => ({
    id: key,
    label: key,
  }));
};
