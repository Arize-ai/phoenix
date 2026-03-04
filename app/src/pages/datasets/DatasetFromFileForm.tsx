import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { FileDropZone, FileList } from "@phoenix/components/dropzone";
import type { FileRejection } from "@phoenix/components/dropzone";
import { ColumnMultiSelector } from "@phoenix/pages/datasets/ColumnMultiSelector";
import { parseCSVColumns } from "@phoenix/utils/csvUtils";
import { formatJSONLError, parseJSONLKeys } from "@phoenix/utils/jsonlUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

type DatasetFileType = "csv" | "jsonl" | null;

type CreateDatasetFromFileParams = {
  file: File | null;
  input_keys: string[];
  output_keys: string[];
  metadata_keys: string[];
  split_keys: string[];
  name: string;
  description: string;
  metadata: Record<string, unknown>;
};

export type DatasetFromFileFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
  onErrorClear?: () => void;
};

/**
 * Detects the file type based on file extension
 */
function detectFileType(fileName: string): DatasetFileType {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (lowerName.endsWith(".jsonl")) {
    return "jsonl";
  }
  return null;
}

const formBodyStyles = css`
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
  .dropdown__button {
    width: 100%;
  }
`;

const dropZoneContainerStyles = css`
  margin-bottom: var(--global-dimension-size-200);
`;

/**
 * Form for creating a dataset from a CSV or JSONL file.
 * Automatically detects file type based on extension.
 */
export function DatasetFromFileForm(props: DatasetFromFileFormProps) {
  const { onDatasetCreated, onDatasetCreateError, onErrorClear } = props;
  const [columns, setColumns] = useState<string[]>([]);
  const [fileType, setFileType] = useState<DatasetFileType>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    resetField,
    setValue,
    watch,
    formState: { isDirty, isValid },
  } = useForm<CreateDatasetFromFileParams>({
    defaultValues: {
      file: null,
      name: "",
      input_keys: [],
      output_keys: [],
      metadata_keys: [],
      split_keys: [],
      description: "",
      metadata: {},
    },
  });

  const selectedFile = watch("file");

  const processFile = useCallback(
    (file: File) => {
      // Reset column selections when a new file is uploaded
      resetField("input_keys");
      resetField("output_keys");
      resetField("metadata_keys");
      resetField("split_keys");

      // Detect file type
      const detectedType = detectFileType(file.name);
      setFileType(detectedType);

      if (!detectedType) {
        onDatasetCreateError(
          new Error("Unsupported file type. Please upload a CSV or JSONL file.")
        );
        return;
      }

      // Set file in form
      setValue("file", file, { shouldValidate: true, shouldDirty: true });

      // Extract dataset name from filename (without extension)
      const name = file.name.replace(/\.(csv|jsonl)$/i, "");
      setValue("name", name);

      // Parse file contents using streaming (handles large files efficiently)
      const parseFile = async () => {
        setIsParsing(true);
        try {
          if (detectedType === "csv") {
            const columnNames = await parseCSVColumns(file);
            setColumns(columnNames);
            onErrorClear?.();
          } else if (detectedType === "jsonl") {
            const result = await parseJSONLKeys(file);
            if (result.success) {
              setColumns(result.keys);
              onErrorClear?.();
            } else {
              onDatasetCreateError(new Error(formatJSONLError(result.error)));
            }
          }
        } catch (error) {
          onDatasetCreateError(
            error instanceof Error ? error : new Error("Failed to parse file")
          );
        } finally {
          setIsParsing(false);
        }
      };
      parseFile();
    },
    [resetField, setValue, onDatasetCreateError, onErrorClear]
  );

  const handleFileSelect = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileRejected = useCallback(
    (rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        onDatasetCreateError(new Error(rejections[0].message));
      }
    },
    [onDatasetCreateError]
  );

  const handleFileRemove = useCallback(() => {
    setValue("file", null, { shouldValidate: true });
    setColumns([]);
    setFileType(null);
    resetField("input_keys");
    resetField("output_keys");
    resetField("metadata_keys");
    resetField("split_keys");
    resetField("name");
    onErrorClear?.();
  }, [setValue, resetField, onErrorClear]);

  const onSubmit = useCallback(
    (data: CreateDatasetFromFileParams) => {
      if (!data.file) {
        return;
      }

      setIsSubmitting(true);
      const formData = new FormData();

      // For JSONL files, ensure the correct content type
      if (fileType === "jsonl") {
        const jsonlFile = new File([data.file], data.file.name, {
          type: "application/jsonl",
        });
        formData.append("file", jsonlFile);
      } else {
        formData.append("file", data.file);
      }

      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("metadata", JSON.stringify(data.metadata));
      data.input_keys.forEach((key) => {
        formData.append("input_keys[]", key);
      });
      data.output_keys.forEach((key) => {
        formData.append("output_keys[]", key);
      });
      data.metadata_keys.forEach((key) => {
        formData.append("metadata_keys[]", key);
      });
      data.split_keys.forEach((key) => {
        formData.append("split_keys[]", key);
      });

      return fetch(prependBasename("/v1/datasets/upload?sync=true"), {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(response.statusText || "Failed to create dataset");
          }
          return response.json();
        })
        .then((res) => {
          onDatasetCreated({
            name: data.name,
            id: res["data"]["dataset_id"],
          });
        })
        .catch((error) => {
          onDatasetCreateError(error);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    },
    [fileType, onDatasetCreated, onDatasetCreateError]
  );

  const shouldDisableFields = isSubmitting || isParsing || !selectedFile;

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div css={formBodyStyles}>
        <Controller
          control={control}
          name="file"
          rules={{ required: "Please select a CSV or JSONL file" }}
          render={({ fieldState: { error } }) => (
            <div css={dropZoneContainerStyles}>
              {!selectedFile ? (
                <FileDropZone
                  acceptedFileTypes={[".csv", ".jsonl"]}
                  allowsMultiple={false}
                  onSelect={handleFileSelect}
                  onSelectRejected={handleFileRejected}
                  label="Drag and drop your dataset file"
                  description="Supports CSV and JSONL formats"
                  aria-label="Dataset file upload"
                />
              ) : (
                <FileList
                  files={[
                    {
                      file: selectedFile,
                      status: isParsing ? "parsing" : "complete",
                    },
                  ]}
                  onRemove={handleFileRemove}
                  isDisabled={isSubmitting}
                />
              )}
              {error?.message && (
                <View marginTop="size-200">
                  <Text color="danger" size="S">
                    {error.message}
                  </Text>
                </View>
              )}
            </div>
          )}
        />

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
              isDisabled={shouldDisableFields}
            >
              <Label>Dataset Name</Label>
              <Input placeholder="e.g. Golden Dataset" />
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
              isDisabled={shouldDisableFields}
              value={value.toString()}
            >
              <Label>Description</Label>
              <TextArea placeholder="e.g. A dataset for structured data extraction" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the dataset</Text>
              )}
            </TextField>
          )}
        />

        <Controller
          name="input_keys"
          control={control}
          rules={{
            required: "At least one input key is required",
          }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="Input keys"
              description={`The ${fileType === "csv" ? "columns" : "keys"} to use as input`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
              isDisabled={shouldDisableFields}
            />
          )}
        />

        <Controller
          name="output_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="Output keys"
              description={`The ${fileType === "csv" ? "columns" : "keys"} to use as output`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
              isDisabled={shouldDisableFields}
            />
          )}
        />

        <Controller
          name="metadata_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="Metadata keys"
              description={`The ${fileType === "csv" ? "columns" : "keys"} to use as metadata`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
              isDisabled={shouldDisableFields}
            />
          )}
        />

        <Controller
          name="split_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="Split keys"
              description={`The ${fileType === "csv" ? "columns" : "keys"} to use for automatically assigning examples to splits`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
              isDisabled={shouldDisableFields}
            />
          )}
        />
      </div>

      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            type="submit"
            isDisabled={!isValid || isSubmitting}
            variant={isDirty ? "primary" : "default"}
            size="S"
            leadingVisual={
              isSubmitting ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
            }
          >
            {isSubmitting ? "Creating..." : "Create Dataset"}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
