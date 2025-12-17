import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { FieldError, Input, Label } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/field";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

const useEvaluatorNameInputForm = () => {
  const store = useEvaluatorStoreInstance();
  const name = useEvaluatorStore((state) => {
    if (state.datasetEvaluator?.id || state.evaluator.isBuiltin) {
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
        const { setEvaluatorName, setEvaluatorDisplayName, datasetEvaluator } =
          store.getState();
        if (datasetEvaluator?.id) {
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
