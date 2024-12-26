import React from "react";
import { Controller, useForm } from "react-hook-form";

import { Flex, Form, TextArea, TextField, View } from "@arizeai/components";

import { Button } from "@phoenix/components";
export type SavePromptSubmitHandler = (params: SavePromptFormParams) => void;

export type SavePromptFormParams = {
  name: string;
  description?: string;
};

export function SavePromptForm({
  onSubmit,
  isSubmitting = false,
  submitButtonText = "Save",
}: {
  onSubmit: SavePromptSubmitHandler;
  isSubmitting?: boolean;
  submitButtonText?: string;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<SavePromptFormParams>({
    defaultValues: {
      name: "Prompt " + new Date().toISOString(),
      description: "",
    },
  });

  return (
    <Form>
      <View padding="size-200">
        <Controller
          name="name"
          control={control}
          rules={{
            required: "Prompt name is required",
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              label="Prompt Name"
              description="The name of your saved prompt"
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              value={value}
            />
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextArea
              label="Description"
              description="A description of your prompt (optional)"
              isRequired={false}
              height={100}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              value={value}
            />
          )}
        />
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            variant={isDirty ? "primary" : "default"}
            size="S"
            onPress={() => handleSubmit(onSubmit)()}
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
