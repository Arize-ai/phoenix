import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { FieldError, Input, Label } from "@phoenix/components";
import { TextField, type TextFieldProps } from "@phoenix/components/field";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";

const useEvaluatorDescriptionInputForm = () => {
  const store = useEvaluatorStoreInstance();
  const description = useEvaluatorStore((state) => {
    return state.evaluator.description;
  });
  const form = useForm({ defaultValues: { description }, mode: "onChange" });
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { description }, isValid }) {
        if (!isValid) {
          return;
        }
        const { setEvaluatorDescription } = store.getState();
        setEvaluatorDescription(description);
      },
    });
  }, [subscribe, store]);
  return form;
};

export const EvaluatorDescriptionInput = ({
  placeholder = "e.g. rate the response on correctness",
  ...props
}: Partial<TextFieldProps> & { placeholder?: string }) => {
  const form = useEvaluatorDescriptionInputForm();
  const isBuiltin = useEvaluatorStore((state) => state.evaluator.isBuiltin);
  const { control } = form;
  return (
    <Controller
      name="description"
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          autoComplete="off"
          isInvalid={!!error}
          isDisabled={!!isBuiltin}
          {...props}
        >
          <Label>Description{isBuiltin ? "" : " (optional)"}</Label>
          <Input placeholder={!isBuiltin ? placeholder : undefined} />
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
};
