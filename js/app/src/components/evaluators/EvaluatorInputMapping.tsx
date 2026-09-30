import type { PropsWithChildren } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
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
 * @param pathsReplaceLiterals - Drops a variable's literal while it has a
 *   path, for forms that cannot show literals: the server applies a literal
 *   over a path. Clearing the path restores the literal.
 */
export const useEvaluatorInputMappingControlsForm = ({
  pruneEmptyEntries = false,
  filterInitialMapping,
  declaredVariables,
  pathsReplaceLiterals = false,
}: {
  pruneEmptyEntries?: boolean;
  pathsReplaceLiterals?: boolean;
  filterInitialMapping?: (
    inputMapping: EvaluatorInputMappingValue
  ) => EvaluatorInputMappingValue;
  /**
   * The variables the evaluator declares. When set, the store only ever holds
   * entries for these: a path left behind by a variable the evaluator no longer
   * declares is still resolved when it runs, and fails it if it matches
   * nothing. The form keeps what was typed, so a variable that comes back
   * brings its path back with it.
   */
  declaredVariables?: readonly string[];
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
    // eslint-disable-next-line react/refs
    () => escapeMapping(pathMapping),
    [pathMapping]
  );
  const escapedLiteralMapping = useMemo(
    // eslint-disable-next-line react/refs
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
  // Keyed by content: callers derive the list on every render.
  const declaredKey =
    declaredVariables == null ? null : JSON.stringify(declaredVariables);
  const declaredNames = useMemo(
    () =>
      declaredKey == null
        ? null
        : new Set<string>(JSON.parse(declaredKey) as string[]),
    [declaredKey]
  );
  const writeToStore = useCallback(
    ({
      pathMapping,
      literalMapping,
    }: {
      pathMapping: Record<string, string>;
      literalMapping: EvaluatorInputMappingValue["literalMapping"];
    }) => {
      const { setPathMapping, setLiteralMapping } = store.getState();
      const write = <T,>(mapping: Record<string, T>) => {
        const unescaped = unescapeMapping(mapping);
        const pruned = pruneEmptyEntries ? pruneEmpty(unescaped) : unescaped;
        return declaredNames
          ? Object.fromEntries(
              Object.entries(pruned).filter(([key]) => declaredNames.has(key))
            )
          : { ...pruned };
      };
      const paths = write(pathMapping ?? {});
      const literals = write(literalMapping ?? {});
      setPathMapping(paths);
      setLiteralMapping(
        pathsReplaceLiterals
          ? Object.fromEntries(
              Object.entries(literals).filter(([key]) => !paths[key])
            )
          : literals
      );
    },
    [store, pruneEmptyEntries, declaredNames, pathsReplaceLiterals]
  );
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values, isValid }) {
        if (!isValid) {
          return;
        }
        writeToStore(values);
      },
    });
  }, [subscribe, writeToStore]);
  // A change to what the evaluator declares rewrites the store even though no
  // field changed. Mounting does not, so a form nobody touched stays clean.
  const getValues = form.getValues;
  const initialDeclaredKeyRef = useRef(declaredKey);
  const hasDeclaredChangedRef = useRef(false);
  useEffect(() => {
    if (
      !hasDeclaredChangedRef.current &&
      declaredKey === initialDeclaredKeyRef.current
    ) {
      return;
    }
    hasDeclaredChangedRef.current = true;
    writeToStore(getValues());
  }, [declaredKey, writeToStore, getValues]);
  return form;
};

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
          Add variables to the prompt to map them here.
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
