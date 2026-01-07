import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Checkbox, Flex, Label, Text } from "@phoenix/components";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useContainsEvaluatorForm = () => {
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

export const ContainsEvaluatorForm = () => {
  const { control, getValues, setValue } = useContainsEvaluatorForm();
  const [containsTextPath, setContainsTextPath] = useState<string>(
    () => getValues("pathMapping.text") ?? ""
  );
  const preMappedInput = useEvaluatorStore((state) => state.preMappedInput);
  const allExampleKeys = useFlattenedEvaluatorInputKeys(preMappedInput);
  return (
    <Flex direction="column" gap="size-200">
      <ContainsEvaluatorCodeBlock />
      <Flex direction="column" gap="size-100">
        <SwitchableEvaluatorInput
          fieldName="text"
          label="Text"
          description="The text to search for the words in. Choose an example field or enter a literal value."
          defaultMode="path"
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Text"
          literalPlaceholder="Enter literal text value"
          pathInputValue={containsTextPath}
          onPathInputChange={setContainsTextPath}
        />
        <SwitchableEvaluatorInput
          fieldName="words"
          label="Words"
          description="A comma separated list of words to search for in the text."
          defaultMode="literal"
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Words"
          literalPlaceholder="e.g. word1, word2, word3"
        />
        <Controller
          name="literalMapping.case_sensitive"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Checkbox
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
              <Label>Case sensitive</Label>
              <Text slot="description">
                Whether to match the words case sensitive.
              </Text>
            </Checkbox>
          )}
        />
      </Flex>
    </Flex>
  );
};
