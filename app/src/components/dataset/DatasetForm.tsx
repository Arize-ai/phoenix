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
}: {
  datasetName?: string | null;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onSubmit: (params: DatasetFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
  formMode: "create" | "edit";
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
            // Only allow submission if the form is dirty for edits
            // When creating allow the user to click create without any changes as the form will be prefilled with valid values
            isDisabled={
              (formMode === "edit" ? !isDirty : false) || isSubmitting
            }
            variant={isDirty ? "primary" : "default"}
            size="S"
            onPress={() => {
              handleSubmit(onSubmit)();
            }}
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
