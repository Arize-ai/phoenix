import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";
import type { DropItem, FileDropItem } from "react-aria-components";
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
  TextField,
  View,
} from "@phoenix/components";
import { DropOverlay, FileInput, DropZone } from "@phoenix/components/dropzone";
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

const ACCEPTED_FILE_TYPES = [".csv", ".jsonl"];

const formBodyCSS = css`
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
  .dropdown__button {
    width: 100%;
  }
`;

const formGridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--global-dimension-size-200);
  margin-bottom: var(--global-dimension-size-200);
`;

/**
 * Form for creating a dataset from a CSV or JSONL file.
 * The entire form is a drop target -- users can drop a file anywhere
 * or use the FileInput browse button.
 */
export function DatasetFromFileForm(props: DatasetFromFileFormProps) {
  const { onDatasetCreated, onDatasetCreateError, onErrorClear } = props;
  const [columns, setColumns] = useState<string[]>([]);
  const [fileType, setFileType] = useState<DatasetFileType>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parseGeneration = useRef(0);

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
      resetField("input_keys");
      resetField("output_keys");
      resetField("metadata_keys");
      resetField("split_keys");
      setColumns([]);

      const detectedType = detectFileType(file.name);
      setFileType(detectedType);

      if (!detectedType) {
        setValue("file", null, { shouldValidate: true });
        resetField("name");
        onDatasetCreateError(
          new Error("Unsupported file type. Please upload a CSV or JSONL file.")
        );
        return;
      }

      setValue("file", file, { shouldValidate: true, shouldDirty: true });

      const name = file.name.replace(/\.(csv|jsonl)$/i, "");
      setValue("name", name);

      const generation = ++parseGeneration.current;
      const parseFile = async () => {
        setIsParsing(true);
        try {
          if (detectedType === "csv") {
            const columnNames = await parseCSVColumns(file);
            if (generation !== parseGeneration.current) return;
            setColumns(columnNames);
            onErrorClear?.();
          } else if (detectedType === "jsonl") {
            const result = await parseJSONLKeys(file);
            if (generation !== parseGeneration.current) return;
            if (result.success) {
              setColumns(result.keys);
              onErrorClear?.();
            } else {
              setColumns([]);
              onDatasetCreateError(new Error(formatJSONLError(result.error)));
            }
          }
        } catch (error) {
          if (generation !== parseGeneration.current) return;
          setColumns([]);
          onDatasetCreateError(
            error instanceof Error ? error : new Error("Failed to parse file")
          );
        } finally {
          if (generation === parseGeneration.current) {
            setIsParsing(false);
          }
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

  const handleFileDrop = useCallback(
    async (e: { items: DropItem[] }) => {
      const fileItems = e.items.filter(
        (item): item is FileDropItem => item.kind === "file"
      );
      const results = await Promise.allSettled(
        fileItems.map((item) => item.getFile())
      );
      const files = results
        .filter(
          (r): r is PromiseFulfilledResult<File> => r.status === "fulfilled"
        )
        .map((r) => r.value);
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
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

  const fileDescription = isParsing ? (
    <Text slot="description" color="text-700">
      Parsing...
    </Text>
  ) : columns.length > 0 ? (
    <Text slot="description" color="success">
      <Flex direction="row" gap="size-50" alignItems="center">
        <Icon svg={<Icons.CheckmarkOutline />} color="success" />
        <span>
          {columns.length} {fileType === "csv" ? "column" : "key"}
          {columns.length !== 1 ? "s" : ""} detected
        </span>
      </Flex>
    </Text>
  ) : (
    <Text slot="description">&nbsp;</Text>
  );

  return (
    <DropZone
      onDrop={handleFileDrop}
      getDropOperation={() => (isSubmitting ? "cancel" : "copy")}
    >
      <DropOverlay>
        {selectedFile ? "Drop file to replace current" : "Drop file"}
      </DropOverlay>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div css={formBodyCSS}>
          <div css={formGridCSS}>
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
                  <Label>Name</Label>
                  <Input placeholder="e.g. Golden Dataset" />
                  {error?.message && <FieldError>{error.message}</FieldError>}
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
                  <Label>Description (optional)</Label>
                  <Input placeholder="e.g. For sentiment analysis" />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : null}
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="file"
              rules={{ required: "Please select a CSV or JSONL file" }}
              render={({ fieldState: { error } }) => (
                <div>
                  <FileInput
                    file={selectedFile}
                    acceptedFileTypes={ACCEPTED_FILE_TYPES}
                    onSelect={handleFileSelect}
                    onClear={handleFileRemove}
                    isDisabled={isSubmitting}
                  >
                    {error?.message ? (
                      <Text slot="description" color="danger">
                        {error.message}
                      </Text>
                    ) : (
                      fileDescription
                    )}
                  </FileInput>
                </div>
              )}
            />

            <Controller
              name="split_keys"
              control={control}
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <ColumnMultiSelector
                  label="Split"
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
              isDisabled={!isValid || isSubmitting || isParsing}
              variant={isDirty ? "primary" : "default"}
              size="S"
              leadingVisual={
                isSubmitting ? (
                  <Icon svg={<Icons.LoadingOutline />} />
                ) : undefined
              }
            >
              {isSubmitting ? "Creating..." : "Create Dataset"}
            </Button>
          </Flex>
        </View>
      </Form>
    </DropZone>
  );
}
