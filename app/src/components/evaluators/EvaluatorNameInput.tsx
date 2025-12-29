import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { FieldError, Input, Label } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/field";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorStoreProps } from "@phoenix/store/evaluatorStore";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

/**
 * Whether to read and write to evaluator.displayName instead of evaluator.name.
 *
 * Built-in evaluators and dataset evaluators should use displayName.
 *
 * @param state - The current state of the evaluator store.
 * @returns True if the evaluator should use displayName, false otherwise.
 */
const shouldUseDisplayName = (state: EvaluatorStoreProps) => {
  if (state.datasetEvaluator?.id || state.evaluator.isBuiltin) {
    return true;
  }
  return false;
};

const useEvaluatorNameInputForm = () => {
  const store = useEvaluatorStoreInstance();
  const name = useEvaluatorStore((state) => {
    if (shouldUseDisplayName(state)) {
      return state.evaluator.displayName;
    }
    return state.evaluator.name;
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
        const { setEvaluatorName, setEvaluatorDisplayName } = store.getState();
        if (shouldUseDisplayName(store.getState())) {
          setEvaluatorDisplayName(name);
        } else {
          setEvaluatorName(name);
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
  const { control } = form;
  return (
    <Controller
      name="name"
      control={control}
      rules={{
        validate: validateIdentifier,
      }}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          autoComplete="off"
          isInvalid={!!error}
          autoFocus
          {...props}
        >
          <Label>Name</Label>
          <Input placeholder={placeholder} />
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
};
