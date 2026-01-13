import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Flex, Label, Switch, Text } from "@phoenix/components";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { ExactMatchEvaluatorCodeBlock } from "@phoenix/components/evaluators/ExactMatchEvaluatorCodeBlock";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useExactMatchEvaluatorForm = () => {
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

export const ExactMatchEvaluatorForm = () => {
  const { control, getValues, setValue } = useExactMatchEvaluatorForm();
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
          description="The expected text to compare against."
          defaultMode={expectedDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Expected"
          literalPlaceholder="Enter expected value"
          pathInputValue={expectedPath}
          onPathInputChange={setExpectedPath}
        />
        <SwitchableEvaluatorInput
          fieldName="actual"
          label="Actual"
          description="The actual text to compare."
          defaultMode={actualDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Actual"
          literalPlaceholder="Enter actual value"
          pathInputValue={actualPath}
          onPathInputChange={setActualPath}
        />
        <Controller
          name="literalMapping.case_sensitive"
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
              <Label>Case sensitive</Label>
              <Text slot="description">
                Whether comparison is case-sensitive.
              </Text>
            </Switch>
          )}
        />
      </Flex>
      <ExactMatchEvaluatorCodeBlock />
    </Flex>
  );
};
