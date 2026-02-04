import { useEffect, useRef } from "react";
import { Controller, useForm, type ValidateResult } from "react-hook-form";

import { FieldError, Input, Label } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/field";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorStoreProps } from "@phoenix/store/evaluatorStore";

/**
 * Transforms an evaluator name by lowercasing, converting spaces to dashes,
 * and stripping disallowed characters.
 */
const transformEvaluatorName = (value: string) =>
  value
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^_a-z0-9-]/g, "");

const ALLOWED_CHARS_REGEX = /^[_a-z0-9-]*$/;
const LEADING_TRAILING_ALPHANUMERIC_REGEX = /^([a-z0-9](.*[a-z0-9])?)?$/;

/**
 * Validates identifier on change (immediate feedback).
 * Only checks for empty and allowed characters.
 */
const validateIdentifierOnChange = (value: string): ValidateResult => {
  if (value.trim() === "") {
    return "Cannot be empty";
  }
  if (!ALLOWED_CHARS_REGEX.test(value)) {
    return "Must have only lowercase alphanumeric characters, dashes, and underscores";
  }
  return true;
};

/**
 * Validates identifier on blur (deferred feedback).
 * Checks start/end character requirements.
 */
const validateIdentifierOnBlur = (value: string): ValidateResult => {
  if (!LEADING_TRAILING_ALPHANUMERIC_REGEX.test(value)) {
    return "Must start and end with lowercase alphanumeric characters";
  }
  return true;
};

/**
 * Whether to use the user-facing name (for dataset evaluators) vs the global name.
 *
 * Built-in evaluators and dataset evaluators should use the user-facing name.
 *
 * @param state - The current state of the evaluator store.
 * @returns True if the evaluator should use the user-facing name, false otherwise.
 */
const shouldUseSpecificName = (state: EvaluatorStoreProps) => {
  if (state.datasetEvaluator?.id || state.evaluator.isBuiltin) {
    return true;
  }
  return false;
};

const useEvaluatorNameInputForm = () => {
  const store = useEvaluatorStoreInstance();
  const name = useEvaluatorStore((state) => {
    if (shouldUseSpecificName(state)) {
      return state.evaluator.name;
    }
    return state.evaluator.globalName;
  });
  const form = useForm({ defaultValues: { name }, mode: "onChange" });
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { name }, isValid }) {
        if (!isValid) {
          return;
        }
        const { setEvaluatorName, setEvaluatorGlobalName } = store.getState();
        if (shouldUseSpecificName(store.getState())) {
          setEvaluatorName(name);
        } else {
          setEvaluatorGlobalName(name);
        }
      },
    });
  }, [subscribe, store]);
  return form;
};

export const EvaluatorNameInput = ({
  placeholder = "e.g. correctness_evaluator",
  ...props
}: Partial<TextFieldProps> & { placeholder?: string }) => {
  const form = useEvaluatorNameInputForm();
  const { control, trigger } = form;
  const inputRef = useRef<HTMLInputElement>(null);
  const hasBlurredRef = useRef(false);

  // Validation that runs on change, with blur-only rules deferred
  const validate = (value: string): ValidateResult => {
    const onChangeResult = validateIdentifierOnChange(value);
    if (onChangeResult !== true) {
      return onChangeResult;
    }
    // Only validate start/end characters after field has been blurred
    if (hasBlurredRef.current) {
      return validateIdentifierOnBlur(value);
    }
    return true;
  };

  return (
    <Controller
      name="name"
      control={control}
      rules={{ validate }}
      render={({ field, fieldState: { error } }) => {
        const handleChange = (value: string) => {
          const input = inputRef.current;
          const selectionStart = input?.selectionStart ?? value.length;

          const transformed = transformEvaluatorName(value);

          // Calculate new cursor position by transforming the text before cursor
          const beforeCursor = value.slice(0, selectionStart);
          const newCursorPosition = transformEvaluatorName(beforeCursor).length;

          field.onChange(transformed);

          // Restore cursor position after React updates the DOM
          requestAnimationFrame(() => {
            input?.setSelectionRange(newCursorPosition, newCursorPosition);
          });
        };

        const handleFocus = () => {
          // Reset blur state so deferred validation doesn't run while typing
          hasBlurredRef.current = false;
        };

        const handleBlur = () => {
          hasBlurredRef.current = true;
          field.onBlur();
          // Re-trigger validation to include blur-only rules
          trigger("name");
        };

        return (
          <TextField
            {...field}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoComplete="off"
            isInvalid={!!error}
            autoFocus
            {...props}
          >
            <Label>Name</Label>
            <Input ref={inputRef} placeholder={placeholder} />
            <FieldError>{error?.message}</FieldError>
          </TextField>
        );
      }}
    />
  );
};
