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
