import { useCallback, useEffect, useRef } from "react";
import { Controller, useForm, type ValidateResult } from "react-hook-form";

import { FieldError, Input, Label, Text } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/core/field";
import { IDENTIFIER_DESCRIPTION } from "@phoenix/constants";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { TransformingInputController } from "@phoenix/hooks/useTransformingInput";
import type { EvaluatorStoreProps } from "@phoenix/store/evaluatorStore";
import {
  transformIdentifierInput,
  validateIdentifier,
} from "@phoenix/utils/identifierUtils";

/**
 * The field name used by react-hook-form and as the error key in the validation registry.
 */
const FIELD_NAME = "name" as const;

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
  placeholder = "e.g. code_eval",
  ...props
}: Partial<TextFieldProps> & { placeholder?: string }) => {
  const form = useEvaluatorNameInputForm();
  const store = useEvaluatorStoreInstance();
  const { control, trigger } = form;
  const hasBlurredRef = useRef(false);

  // Register with the evaluator store so the parent can trigger
  // validation on submit. Also forces deferred (blur-only) errors to display.
  const triggerValidation = useCallback(async () => {
    hasBlurredRef.current = true;
    return trigger(FIELD_NAME);
  }, [trigger]);
  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator(FIELD_NAME, triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  // Validates the name field.
  // Display of blur-specific errors is handled separately in render.
  const validate = (value: string): ValidateResult => {
    return validateIdentifier(value);
  };

  return (
    <Controller
      name={FIELD_NAME}
      control={control}
      rules={{ validate }}
      render={({ field, fieldState: { error } }) => {
        // Identifier errors are deferred until blur or parent-form submission.
        const shouldShowError = error?.message && hasBlurredRef.current;
        const displayedError = shouldShowError ? error.message : undefined;

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
          <TransformingInputController
            value={field.value}
            onValueChange={field.onChange}
            transformValue={transformIdentifierInput}
          >
            {(transformingInput) => (
              <TextField
                {...field}
                value={transformingInput.displayValue}
                onChange={transformingInput.handleValueChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoComplete="off"
                isInvalid={!!displayedError}
                autoFocus
                {...props}
              >
                <Label>Name</Label>
                <Input
                  {...transformingInput.inputProps}
                  placeholder={placeholder}
                />
                <Text slot="description">{IDENTIFIER_DESCRIPTION}</Text>
                <FieldError>{displayedError}</FieldError>
              </TextField>
            )}
          </TransformingInputController>
        );
      }}
    />
  );
};
