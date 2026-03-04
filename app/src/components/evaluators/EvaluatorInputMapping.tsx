import type { PropsWithChildren } from "react";
import { Suspense, useEffect, useMemo } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";

import { Label, Loading, Switch, Text } from "@phoenix/components";
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
      {variables.map(({ name, type: paramType }) => {
        const escapedVariable = escapeFieldNameForReactHookForm(name);

        if (paramType === "boolean") {
          return (
            <BooleanParamInput
              key={name}
              name={name}
              escapedName={escapedVariable}
              control={control}
            />
          );
        }

        const inputType =
          paramType === "integer" || paramType === "number" ? "number" : "text";

        return (
          <SwitchableEvaluatorInput
            key={name}
            fieldName={escapedVariable}
            label={name}
            size="M"
            defaultMode="path"
            control={control}
            pathOptions={allExampleKeys}
            pathPlaceholder={name}
            literalPlaceholder="Enter a value"
            pathInputValue={inputValues[name] ?? ""}
            onPathInputChange={(val) =>
              setValue(`pathMapping.${escapedVariable}`, val)
            }
            inputType={inputType}
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

const BooleanParamInput = <TFieldValues extends FieldValues>({
  name,
  escapedName,
  control,
}: {
  name: string;
  escapedName: string;
  control: Control<TFieldValues>;
}) => {
  const literalFieldName =
    `literalMapping.${escapedName}` as `literalMapping.${string}` &
      Path<TFieldValues>;
  return (
    <Controller
      name={literalFieldName}
      control={control}
      defaultValue={false as TFieldValues[typeof literalFieldName]}
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
          <Label>{name}</Label>
        </Switch>
      )}
    />
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
