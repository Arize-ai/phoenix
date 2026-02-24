import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Flex, Label, Switch, Text } from "@phoenix/components";
import { RegexField } from "@phoenix/components/RegexField";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";
import { BuiltInEvaluatorOutputConfig } from "@phoenix/features/experiments/components/evaluators/BuiltInEvaluatorOutputConfig";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/features/experiments/components/evaluators/EvaluatorInputMapping";
import { RegexEvaluatorCodeBlock } from "@phoenix/features/experiments/components/evaluators/RegexEvaluatorCodeBlock";
import { SwitchableEvaluatorInput } from "@phoenix/features/experiments/components/evaluators/SwitchableEvaluatorInput";

const useRegexEvaluatorForm = () => {
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

export const RegexEvaluatorForm = () => {
  const form = useRegexEvaluatorForm();
  const { control, getValues, setValue, trigger } = form;
  const store = useEvaluatorStoreInstance();
  const [textPath, setTextPath] = useState<string>(
    () => getValues("pathMapping.text") ?? ""
  );

  // Cache for the latest async regex validation result from RegexField.
  // Read by the validate rule so trigger() returns the correct validity.
  // Initially set to true to avoid error flickering when the user starts typing.
  const regexValidCache = useRef(true);

  // Updates the cache and re-syncs RHF error state via trigger().
  const handleRegexValidationChange = useCallback(
    (valid: boolean) => {
      regexValidCache.current = valid;
      trigger("literalMapping.pattern");
    },
    [trigger]
  );

  const triggerValidation = useCallback(async () => {
    return trigger([
      "literalMapping.pattern",
      "pathMapping.text",
      "literalMapping.text",
    ]);
  }, [trigger]);

  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator("regexFields", triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(evaluatorMappingSource);

  // Determine initial mode based on existing values
  const textDefaultMode =
    getValues("literalMapping.text") != null ? "literal" : "path";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-100">
        <Controller
          control={control}
          name="literalMapping.pattern"
          rules={{
            required: "Regex pattern is required",
            validate: () => regexValidCache.current,
          }}
          render={({ field, fieldState: { error } }) => (
            <RegexField
              {...field}
              value={String(field.value ?? "")}
              isInvalid={!!error}
              error={error?.message}
              description="The regex pattern to match against the text. e.g. ^[0-9]+$"
              label="Pattern*"
              placeholder="e.g. ^[0-9]+$"
              onValidationChange={handleRegexValidationChange}
            />
          )}
        />
        <SwitchableEvaluatorInput
          fieldName="text"
          label="Text"
          description="The text to search."
          defaultMode={textDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Text"
          literalPlaceholder="Enter text value"
          pathInputValue={textPath}
          onPathInputChange={setTextPath}
          isRequired
        />
        <Controller
          name="literalMapping.full_match"
          control={control}
          defaultValue={false}
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
              <Label>Full match</Label>
              <Text slot="description">
                If true, pattern must match entire text; if false, searches for
                pattern anywhere.
              </Text>
            </Switch>
          )}
        />
      </Flex>
      <BuiltInEvaluatorOutputConfig />
      <RegexEvaluatorCodeBlock />
    </Flex>
  );
};
