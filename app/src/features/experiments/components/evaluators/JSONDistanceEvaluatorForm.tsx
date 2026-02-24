import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Flex, Label, Switch, Text } from "@phoenix/components";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";
import { BuiltInEvaluatorOutputConfig } from "@phoenix/features/experiments/components/evaluators/BuiltInEvaluatorOutputConfig";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/features/experiments/components/evaluators/EvaluatorInputMapping";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/features/experiments/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import { SwitchableEvaluatorInput } from "@phoenix/features/experiments/components/evaluators/SwitchableEvaluatorInput";

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
  const { control, getValues, setValue, watch, trigger } =
    useJSONDistanceEvaluatorForm();
  const parseStrings = watch("literalMapping.parse_strings") ?? true;
  const store = useEvaluatorStoreInstance();
  const [expectedPath, setExpectedPath] = useState<string>(
    () => getValues("pathMapping.expected") ?? ""
  );
  const [actualPath, setActualPath] = useState<string>(
    () => getValues("pathMapping.actual") ?? ""
  );
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(evaluatorMappingSource);

  // Register validator for required SwitchableEvaluatorInput fields.
  const triggerValidation = useCallback(async () => {
    return trigger([
      "pathMapping.expected",
      "literalMapping.expected",
      "pathMapping.actual",
      "literalMapping.actual",
    ]);
  }, [trigger]);
  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator("jsonDistanceFields", triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  // Determine initial mode based on existing values
  const expectedDefaultMode =
    getValues("literalMapping.expected") != null ? "literal" : "path";
  const actualDefaultMode =
    getValues("literalMapping.actual") != null ? "literal" : "path";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-100">
        <SwitchableEvaluatorInput
          fieldName="expected"
          label="Expected"
          description="The expected JSON string."
          defaultMode={expectedDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Expected"
          literalPlaceholder="Enter expected JSON"
          pathInputValue={expectedPath}
          onPathInputChange={setExpectedPath}
          isRequired
        />
        <SwitchableEvaluatorInput
          fieldName="actual"
          label="Actual"
          description="The actual JSON string to compare."
          defaultMode={actualDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Actual"
          literalPlaceholder="Enter actual JSON"
          pathInputValue={actualPath}
          onPathInputChange={setActualPath}
          isRequired
        />
        <Controller
          name="literalMapping.parse_strings"
          control={control}
          defaultValue={true}
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
                    : true
              )}
            >
              <Label>Parse strings as JSON</Label>
              <Text slot="description">
                When enabled, string inputs are parsed as JSON before
                comparison. When disabled, inputs are compared as-is.
              </Text>
            </Switch>
          )}
        />
      </Flex>
      <BuiltInEvaluatorOutputConfig />
      <JSONDistanceEvaluatorCodeBlock parseStrings={Boolean(parseStrings)} />
    </Flex>
  );
};
