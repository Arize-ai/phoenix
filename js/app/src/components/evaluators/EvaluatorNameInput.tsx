import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, type ValidateResult } from "react-hook-form";

import { FieldError, Input, Label, Text } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/core/field";
import {
  IDENTIFIER_DESCRIPTION,
  IDENTIFIER_ERROR_MESSAGES,
} from "@phoenix/constants";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { TransformingInputController } from "@phoenix/hooks/useTransformingInput";
import type { EvaluatorStoreProps } from "@phoenix/store/evaluatorStore";
import type { EvaluatorKind } from "@phoenix/types";
import {
  transformIdentifierInput,
  trimIdentifierSeparators,
  validateIdentifier,
} from "@phoenix/utils/identifierUtils";

/**
 * The field name used by react-hook-form and as the error key in the validation registry.
 */
const FIELD_NAME = "name" as const;

const NAME_PLACEHOLDERS: Record<EvaluatorKind, string> = {
  LLM: "e.g. llm_eval",
  CODE: "e.g. code_eval",
  BUILTIN: "e.g. correctness",
  DECISION: "e.g. decision_eval",
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
  const form = useForm({
    defaultValues: { [FIELD_NAME]: name },
    mode: "onChange",
  });
  const { getValues, setValue, subscribe } = form;
  useEffect(() => {
    if (getValues(FIELD_NAME) !== name) {
      setValue(FIELD_NAME, name, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [getValues, name, setValue]);
  // Sync valid values to the store
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { [FIELD_NAME]: name }, isValid }) {
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
  placeholder,
  description,
  onValueChange,
  ...props
}: Partial<TextFieldProps> & {
  placeholder?: string;
  description?: string;
  onValueChange?: () => void;
}) => {
  const form = useEvaluatorNameInputForm();
  const store = useEvaluatorStoreInstance();
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  const { control, trigger, getValues } = form;
  const inputRef = useRef<HTMLInputElement>(null);
  const hasBlurredRef = useRef(false);
  // An untouched empty name is not an error until the user edits and leaves it
  // or tries to save; the placeholder says what belongs there, and the rest of
  // the form (including test runs) works without a name.
  const hasChangedRef = useRef(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Register with the evaluator store so the parent can trigger
  // validation on submit. Also forces deferred (blur-only) errors to display.
  const triggerValidation = useCallback(async () => {
    hasBlurredRef.current = true;
    setHasSubmitted(true);
    const isValid = await trigger(FIELD_NAME);
    const isFilled = getValues(FIELD_NAME).trim().length > 0;
    if (!isValid || !isFilled) {
      // The field sits at the top of a panel the author has likely scrolled
      // past; bring the error to them rather than leaving it off-screen.
      inputRef.current?.scrollIntoView?.({ block: "center" });
      inputRef.current?.focus();
    }
    return isValid && isFilled;
  }, [trigger, getValues]);
  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator(FIELD_NAME, triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  // Validates the name field. Emptiness is left to render/submit (see
  // `hasSubmitted`), so a cleared field still syncs its empty value to the
  // store rather than leaving the previous name behind. Display of
  // blur-specific errors is handled separately in render.
  const validate = (value: string): ValidateResult => {
    if (value.trim().length === 0) {
      return true;
    }
    return validateIdentifier(value);
  };

  return (
    <Controller
      name={FIELD_NAME}
      control={control}
      rules={{ validate }}
      render={({ field, fieldState: { error } }) => {
        // Only show blur-specific errors after the field has been blurred
        const shouldShowError =
          error?.message &&
          (hasChangedRef.current || hasSubmitted) &&
          (hasBlurredRef.current ||
            hasSubmitted ||
            error.message !== IDENTIFIER_ERROR_MESSAGES.leadingTrailing);
        const emptyError =
          (hasSubmitted || (hasChangedRef.current && hasBlurredRef.current)) &&
          field.value.trim().length === 0
            ? IDENTIFIER_ERROR_MESSAGES.empty
            : undefined;
        const displayedError =
          emptyError ?? (shouldShowError ? error.message : undefined);

        const handleFocus = () => {
          // Reset blur state so deferred validation doesn't run while typing
          hasBlurredRef.current = false;
        };

        return (
          <TransformingInputController
            value={field.value}
            onValueChange={(value) => {
              onValueChange?.();
              hasChangedRef.current = true;
              field.onChange(value);
            }}
            transformValue={transformIdentifierInput}
            finalizeValue={trimIdentifierSeparators}
          >
            {(transformingInput) => (
              <TextField
                {...field}
                value={transformingInput.displayValue}
                onChange={transformingInput.handleValueChange}
                onFocus={handleFocus}
                onBlur={() => {
                  transformingInput.handleBlur();
                  hasBlurredRef.current = true;
                  field.onBlur();
                  // Re-trigger validation to include blur-only rules
                  trigger("name");
                }}
                autoComplete="off"
                isInvalid={!!displayedError}
                autoFocus
                {...props}
              >
                <Label>Name</Label>
                <Input
                  {...transformingInput.inputProps}
                  ref={(node) => {
                    transformingInput.inputProps.ref.current = node;
                    inputRef.current = node;
                  }}
                  placeholder={placeholder ?? NAME_PLACEHOLDERS[evaluatorKind]}
                />
                <Text slot="description">
                  {description ?? IDENTIFIER_DESCRIPTION}
                </Text>
                <FieldError>{displayedError}</FieldError>
              </TextField>
            )}
          </TransformingInputController>
        );
      }}
    />
  );
};
