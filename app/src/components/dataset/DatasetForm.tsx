import { css } from "@emotion/react";
import { useEffect, useImperativeHandle } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

const formBodyStyles = css`
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
`;

export type DatasetFormParams = {
  name: string;
  description: string;
  metadata: string;
};

export type DatasetFormHandle = {
  submit: () => void;
  reset: () => void;
};

export function DatasetForm({
  datasetName,
  datasetDescription,
  datasetMetadata,
  onSubmit,
  isSubmitting,
  submitButtonText,
  formMode,
  ref,
  onValidChange,
  hideFooter,
}: {
  datasetName?: string | null;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onSubmit: (params: DatasetFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
  formMode: "create" | "edit";
  ref?: React.Ref<DatasetFormHandle>;
  onValidChange?: (isValid: boolean) => void;
  hideFooter?: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { isDirty, isValid },
  } = useForm<DatasetFormParams>({
    mode: "onChange",
    defaultValues: {
      name: datasetName ?? "Dataset " + new Date().toISOString(),
      description: datasetDescription ?? "",
      metadata: JSON.stringify(datasetMetadata, null, 2) ?? "{}",
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(onSubmit)(),
      reset: () => resetForm(),
    }),
    [handleSubmit, onSubmit, resetForm]
  );

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div css={formBodyStyles}>
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
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Dataset Name</Label>
              <Input placeholder="e.x. Golden Dataset" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The name of the dataset</Text>
              )}
            </TextField>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Description</Label>
              <TextArea placeholder="e.x. A golden dataset for structured data extraction" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the dataset</Text>
              )}
            </TextField>
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
            fieldState: { error },
          }) => (
            <CodeEditorFieldWrapper
              label={"metadata"}
              errorMessage={error?.message}
              description={`A JSON object containing metadata for the dataset`}
            >
              <JSONEditor value={value} onChange={onChange} onBlur={onBlur} />
            </CodeEditorFieldWrapper>
          )}
        />
      </div>
      {!hideFooter && (
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              isDisabled={
                (formMode === "edit" ? !isDirty : false) || isSubmitting
              }
              variant={isDirty ? "primary" : "default"}
              size="S"
              type="submit"
            >
              {submitButtonText}
            </Button>
          </Flex>
        </View>
      )}
    </Form>
  );
}
