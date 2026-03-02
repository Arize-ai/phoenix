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
import type {
  FileRejection,
  FileWithProgress,
} from "@phoenix/components/dropzone";
import { ColumnMultiSelector } from "@phoenix/pages/datasets/ColumnMultiSelector";
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

/**
 * Parses CSV text to extract column names from the header row
 */
function parseCSVColumns(csvText: string): string[] {
  const lines = csvText.split("\n");
  if (lines.length > 0) {
    return lines[0].split(",").map((name) => name.trim());
  }
  return [];
}

/**
 * Parses JSONL text to extract all unique keys from all JSON objects
 */
function parseJSONLKeys(
  jsonlText: string,
  onError: (error: Error) => void
): string[] {
  try {
    const lines = jsonlText.split("\n");
    return Array.from(
      new Set(
        lines
          .filter((line) => line.trim() !== "")
          .map((line) => {
            const json = JSON.parse(line);
            return Object.keys(json);
          })
          .flat()
      )
    );
  } catch (error) {
    onError(error as Error);
    return [];
  }
}

const formBodyStyles = css`
  /* Constrain form body to allow scrolling while keeping footer visible */
  /* 280px accounts for dialog header, tabs, footer, and modal margins */
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  overscroll-behavior: none;
  padding: var(--global-dimension-size-200);
  .dropdown__button {
    width: 100%;
  }
`;

const dropZoneContainerStyles = css`
  margin-bottom: var(--global-dimension-size-200);
`;

const fileInfoStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin-bottom: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-100);
  background: var(--global-background-color-muted);
  border-radius: var(--global-rounding-small);
`;

const fileTypeTagStyles = css`
  display: inline-flex;
  align-items: center;
  padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
  background: var(--global-color-primary);
  color: var(--global-text-color-inverted);
  border-radius: var(--global-rounding-small);
  font-size: var(--global-dimension-static-font-size-75);
  font-weight: 500;
  text-transform: uppercase;
`;

/**
 * Form for creating a dataset from a CSV or JSONL file.
 * Automatically detects file type based on extension.
 */
export function DatasetFromFileForm(props: DatasetFromFileFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const [columns, setColumns] = useState<string[]>([]);
  const [fileType, setFileType] = useState<DatasetFileType>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileWithProgress[]>([]);
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

      // Update selected files for display
      setSelectedFiles([{ file, status: "complete" }]);

      // Set file in form
      setValue("file", file, { shouldValidate: true, shouldDirty: true });

      // Extract dataset name from filename (without extension)
      const name = file.name.replace(/\.(csv|jsonl)$/i, "");
      setValue("name", name);

      // Read and parse file contents
      const reader = new FileReader();
      reader.onload = function (e) {
        if (!e.target) {
          return;
        }
        const text = e.target.result as string;

        if (detectedType === "csv") {
          const columnNames = parseCSVColumns(text);
          setColumns(columnNames);
        } else if (detectedType === "jsonl") {
          const keys = parseJSONLKeys(text, onDatasetCreateError);
          setColumns(keys);
        }
      };
      reader.readAsText(file);
    },
    [resetField, setValue, onDatasetCreateError]
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
    setSelectedFiles([]);
    setColumns([]);
    setFileType(null);
    resetField("input_keys");
    resetField("output_keys");
    resetField("metadata_keys");
    resetField("split_keys");
    resetField("name");
  }, [setValue, resetField]);

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
                <div css={fileInfoStyles}>
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text weight="heavy">Selected file</Text>
                    {fileType && (
                      <span css={fileTypeTagStyles}>{fileType}</span>
                    )}
                  </Flex>
                  <FileList files={selectedFiles} onRemove={handleFileRemove} />
                </div>
              )}
              {error?.message && (
                <Text color="danger" size="S">
                  {error.message}
                </Text>
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
