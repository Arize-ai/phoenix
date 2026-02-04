import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Flex, Label, Switch, Text } from "@phoenix/components";
import { BuiltInEvaluatorOutputConfig } from "@phoenix/components/evaluators/BuiltInEvaluatorOutputConfig";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { RegexEvaluatorCodeBlock } from "@phoenix/components/evaluators/RegexEvaluatorCodeBlock";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { RegexField } from "@phoenix/components/RegexField";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

/**
 * Validates that a value is a valid regular expression.
 * Returns true if valid, or an error message if invalid.
 */
const validateRegex = (value: string | number | boolean): true | string => {
  const pattern = String(value ?? "");
  if (!pattern) {
    return "Pattern is required";
  }
  try {
    new RegExp(pattern);
    return true;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid regular expression";
  }
};

const VALIDATION_DISPLAY_DELAY_MS = 750;

/**
 * Debounces field error display to provide a grace period while typing (prevents
 * opening a bracket and immediately turning red). Underlying validation is immediate,
 * so the form can't be snipe-submitted with an invalid state.
 */
const useDebouncedError = (error: string | undefined) => {
  const [displayedError, setDisplayedError] = useState(error);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (error) {
      timeoutRef.current = setTimeout(() => {
        setDisplayedError(error);
      }, VALIDATION_DISPLAY_DELAY_MS);
    } else {
      setDisplayedError(undefined);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [error]);

  // Pending = there's an error but we haven't shown it yet
  const isPending = error != null && displayedError == null;

  return { displayedError, isPending };
};

/**
 * Wrapper around RegexField that debounces error display.
 */
const DebouncedRegexField = ({
  field,
  error,
  description,
  label,
  placeholder,
}: {
  field: {
    value: unknown;
    onChange: (value: string) => void;
    onBlur: () => void;
    name: string;
  };
  error: string | undefined;
  description: string;
  label: string;
  placeholder: string;
}) => {
  const { displayedError, isPending } = useDebouncedError(error);

  return (
    <RegexField
      {...field}
      value={String(field.value ?? "")}
      isInvalid={!!displayedError}
      isPending={isPending}
      error={displayedError}
      description={description}
      label={label}
      placeholder={placeholder}
    />
  );
};

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
  const { control, getValues, setValue } = useRegexEvaluatorForm();
  const [textPath, setTextPath] = useState<string>(
    () => getValues("pathMapping.text") ?? ""
  );
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
            validate: validateRegex,
          }}
          render={({ field, fieldState: { error } }) => (
            <DebouncedRegexField
              field={field}
              error={error?.message}
              description="The regex pattern to match against the text. e.g. ^[0-9]+$"
              label="Pattern*"
              placeholder="e.g. ^[0-9]+$"
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
