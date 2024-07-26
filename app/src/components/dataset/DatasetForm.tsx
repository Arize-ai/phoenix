import React from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  Flex,
  Form,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

export type DatasetFormParams = {
  name: string;
  description: string;
  metadata: string;
};

export function DatasetForm({
  datasetName,
  datasetDescription,
  datasetMetadata,
  onSubmit,
  isSubmitting,
  submitButtonText,
}: {
  datasetName?: string | null;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onSubmit: (params: DatasetFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<DatasetFormParams>({
    defaultValues: {
      name: datasetName ?? "Dataset " + new Date().toISOString(),
      description: datasetDescription ?? "",
      metadata: JSON.stringify(datasetMetadata, null, 2) ?? "{}",
    },
  });

  return (
    <Form>
      <View padding="size-200">
        <Controller
          name="name"
          control={control}
          rules={{
            required: "Dataset name is required",
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              label="Dataset Name"
              description={`The name of the dataset`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
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
              label="description"
              description={`A description of the dataset`}
              isRequired={false}
              height={100}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              value={value?.toString()}
            />
          )}
        />
        <Controller
          name="metadata"
          control={control}
          rules={{
            validate: (value) => {
              if (!isJSONObjectString(value)) {
                return "metadata must be a valid JSON object";
              }
              return true;
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <CodeEditorFieldWrapper
              validationState={invalid ? "invalid" : "valid"}
              label={"metadata"}
              errorMessage={error?.message}
              description={`A JSON object containing metadata for the dataset`}
            >
              <JSONEditor value={value} onChange={onChange} onBlur={onBlur} />
            </CodeEditorFieldWrapper>
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
            disabled={!isDirty}
            variant={isDirty ? "primary" : "default"}
            size="compact"
            loading={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
