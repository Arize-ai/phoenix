import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";

import {
  Alert,
  Button,
  DialogFooter,
  FieldError,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

const formCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const formBodyCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
`;

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
  formMode,
  errorMessage,
  onCancel,
}: {
  datasetName?: string | null;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onSubmit: (params: DatasetFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
  formMode: "create" | "edit";
  errorMessage?: string | null;
  onCancel?: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<DatasetFormParams>({
    mode: "onChange",
    defaultValues: {
      name: datasetName ?? "Dataset " + new Date().toISOString(),
      description: datasetDescription ?? "",
      metadata: JSON.stringify(datasetMetadata, null, 2) ?? "{}",
    },
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)} css={formCSS}>
      <div css={formBodyCSS}>
        {errorMessage && (
          <Alert variant="danger" banner>
            {errorMessage}
          </Alert>
        )}
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
      <DialogFooter>
        {onCancel && (
          <Button
            variant="default"
            size="M"
            onPress={onCancel}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          isDisabled={(formMode === "edit" ? !isDirty : false) || isSubmitting}
          variant={isDirty ? "primary" : "default"}
          size="M"
          type="submit"
        >
          {submitButtonText}
        </Button>
      </DialogFooter>
    </Form>
  );
}
