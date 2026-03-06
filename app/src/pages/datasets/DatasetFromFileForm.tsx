import { css } from "@emotion/react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";

import {
  FieldError,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextField,
} from "@phoenix/components";
import {
  FileDropZone,
  FileList,
  type FileWithProgress,
} from "@phoenix/components/core/dropzone";
import {
  countCSVRows,
  parseCSVColumns,
  parseCSVRows,
} from "@phoenix/utils/csvUtils";
import {
  countJSONLRows,
  formatJSONLError,
  parseJSONLKeys,
  parseJSONLRows,
} from "@phoenix/utils/jsonlUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import {
  ColumnAssigner,
  type ColumnAssignerValue,
  getAutoAssignment,
} from "./ColumnAssigner";
import { ColumnMultiSelector } from "./ColumnMultiSelector";
import { DatasetPreviewTable } from "./DatasetPreview";
import { RowPreviewTable } from "./RowPreview";

/**
 * Auto-assign columns based on exact name matching.
 * Only "input", "output", and "metadata" columns are auto-assigned.
 */
function computeAutoAssignment(columns: string[]): ColumnAssignerValue {
  const result: ColumnAssignerValue = { input: [], output: [], metadata: [] };
  for (const column of columns) {
    const bucket = getAutoAssignment(column);
    if (bucket === "input") {
      result.input.push(column);
    } else if (bucket === "output") {
      result.output.push(column);
    } else if (bucket === "metadata") {
      result.metadata.push(column);
    }
    // "source" bucket means no auto-assignment
  }
  return result;
}

type DatasetFileType = "csv" | "jsonl" | null;

type PreviewData = string[][] | Record<string, unknown>[];

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

export type DatasetFormHandle = {
  submit: () => void;
  reset: () => void;
};

export type DatasetFromFileFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
  onErrorClear?: () => void;
  onValidChange?: (isValid: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
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
const PREVIEW_ROW_COUNT = 10;

const formContainerCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const emptyStateCSS = css`
  display: flex;
  flex: 1 1 auto;
  padding: var(--global-dimension-size-200);
`;

const largeDropZoneCSS = css`
  flex: 1 1 auto;
  min-height: 300px;

  .file-drop-zone__icon {
    width: 64px;
    height: 64px;
  }

  .file-drop-zone__icon svg {
    width: 64px;
    height: 64px;
  }

  .file-drop-zone__label {
    font-size: var(--global-font-size-l);
    margin-top: var(--global-dimension-size-200);
  }

  .file-drop-zone__description {
    font-size: var(--global-font-size-m);
  }
`;

const formBodyCSS = css`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  .dropdown__button {
    width: 100%;
  }
`;

const formGridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--global-dimension-size-200);
`;

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const sectionHeaderCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  font-size: var(--global-font-size-s);
  color: var(--global-text-color-700);
`;

const previewTableContainerCSS = css`
  border: 1px solid var(--global-color-gray-200);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;
`;

/**
 * Form for creating a dataset from a CSV or JSONL file.
 * Shows a large dropzone when no file is selected, then reveals
 * the full form with file preview and column assignment.
 */
export function DatasetFromFileForm({
  onDatasetCreated,
  onDatasetCreateError,
  onErrorClear,
  onValidChange,
  onSubmittingChange,
  ref,
}: DatasetFromFileFormProps & { ref?: React.Ref<DatasetFormHandle> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewData>([]);
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null);
  const [fileType, setFileType] = useState<DatasetFileType>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(
    null
  );
  const parseGeneration = useRef(0);

  const {
    control,
    handleSubmit,
    resetField,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<CreateDatasetFromFileParams>({
    mode: "onChange",
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
  const inputKeys = watch("input_keys");
  const outputKeys = watch("output_keys");
  const metadataKeys = watch("metadata_keys");

  // Create controlled value for ColumnAssigner
  const columnAssignerValue: ColumnAssignerValue = {
    input: inputKeys,
    output: outputKeys,
    metadata: metadataKeys,
  };

  const handleColumnAssignerChange = useCallback(
    (value: ColumnAssignerValue) => {
      setValue("input_keys", value.input, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("output_keys", value.output, { shouldDirty: true });
      setValue("metadata_keys", value.metadata, { shouldDirty: true });
    },
    [setValue]
  );

  const processFile = useCallback(
    (file: File) => {
      resetField("input_keys");
      resetField("output_keys");
      resetField("metadata_keys");
      resetField("split_keys");
      setColumns([]);
      setPreviewRows([]);
      setTotalRowCount(null);

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
      setValue("name", name, { shouldValidate: true });

      const generation = ++parseGeneration.current;
      const parseFile = async () => {
        setIsParsing(true);
        try {
          if (detectedType === "csv") {
            // Parse columns, preview rows, and count total in parallel
            const [columnNames, rows, rowCount] = await Promise.all([
              parseCSVColumns(file),
              parseCSVRows(file, PREVIEW_ROW_COUNT),
              countCSVRows(file),
            ]);
            if (generation !== parseGeneration.current) return;
            setColumns(columnNames);
            setPreviewRows(rows);
            setTotalRowCount(rowCount);
            // Auto-assign columns based on naming patterns
            const autoAssigned = computeAutoAssignment(columnNames);
            setValue("input_keys", autoAssigned.input, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setValue("output_keys", autoAssigned.output, { shouldDirty: true });
            setValue("metadata_keys", autoAssigned.metadata, {
              shouldDirty: true,
            });
            onErrorClear?.();
          } else if (detectedType === "jsonl") {
            // Parse keys first, then rows and count
            const keysResult = await parseJSONLKeys(file);
            if (generation !== parseGeneration.current) return;
            if (keysResult.success) {
              setColumns(keysResult.keys);
              const [rows, rowCount] = await Promise.all([
                parseJSONLRows(file, PREVIEW_ROW_COUNT),
                countJSONLRows(file),
              ]);
              if (generation !== parseGeneration.current) return;
              setPreviewRows(rows);
              setTotalRowCount(rowCount);
              // Auto-assign columns based on naming patterns
              const autoAssigned = computeAutoAssignment(keysResult.keys);
              setValue("input_keys", autoAssigned.input, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setValue("output_keys", autoAssigned.output, {
                shouldDirty: true,
              });
              setValue("metadata_keys", autoAssigned.metadata, {
                shouldDirty: true,
              });
              onErrorClear?.();
            } else {
              setColumns([]);
              setPreviewRows([]);
              setTotalRowCount(null);
              onDatasetCreateError(
                new Error(formatJSONLError(keysResult.error))
              );
            }
          }
        } catch (error) {
          if (generation !== parseGeneration.current) return;
          setColumns([]);
          setPreviewRows([]);
          setTotalRowCount(null);
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

  const handleFileRemove = useCallback(() => {
    setValue("file", null, { shouldValidate: true });
    setColumns([]);
    setPreviewRows([]);
    setTotalRowCount(null);
    setFileType(null);
    resetField("input_keys");
    resetField("output_keys");
    resetField("metadata_keys");
    resetField("split_keys");
    resetField("name");
    onErrorClear?.();
  }, [setValue, resetField, onErrorClear]);

  const handleColumnAssignerReset = useCallback(() => {
    const autoAssigned = computeAutoAssignment(columns);
    setValue("input_keys", autoAssigned.input, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("output_keys", autoAssigned.output, { shouldDirty: true });
    setValue("metadata_keys", autoAssigned.metadata, { shouldDirty: true });
  }, [columns, setValue]);

  const onSubmit = useCallback(
    (data: CreateDatasetFromFileParams) => {
      if (!data.file) {
        return;
      }

      setIsSubmitting(true);
      const formData = new FormData();

      switch (fileType) {
        case "jsonl": {
          const jsonlFile = new File([data.file], data.file.name, {
            type: "application/jsonl",
          });
          formData.append("file", jsonlFile);
          break;
        }
        case "csv": {
          const csvFile = new File([data.file], data.file.name, {
            type: "text/csv",
          });
          formData.append("file", csvFile);
          break;
        }
        default:
          invariant(false, `Invalid file type: ${fileType}`);
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
    [fileType, onDatasetCreated, onDatasetCreateError, setIsSubmitting]
  );

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(onSubmit)(),
      reset: handleFileRemove,
    }),
    [handleSubmit, onSubmit, handleFileRemove]
  );

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const hasPreviewData = columns.length > 0 && previewRows.length > 0;

  // Show large dropzone empty state when no file is selected
  if (!selectedFile) {
    return (
      <div css={emptyStateCSS}>
        <FileDropZone
          css={largeDropZoneCSS}
          acceptedFileTypes={ACCEPTED_FILE_TYPES}
          onSelect={handleFileSelect}
          label="Drop a CSV or JSONL file here"
          description="or click to browse"
        />
      </div>
    );
  }

  const fileListItem: FileWithProgress = {
    file: selectedFile,
    status: isParsing
      ? "parsing"
      : totalRowCount !== null
        ? "complete"
        : undefined,
  };

  return (
    <Form css={formContainerCSS}>
      <div css={formBodyCSS}>
        <FileList
          files={[fileListItem]}
          onRemove={handleFileRemove}
          isDisabled={isSubmitting}
        />

        {/* Dataset details */}
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
                isDisabled={isSubmitting || isParsing}
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
                isDisabled={isSubmitting || isParsing}
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
        </div>

        {/* File Preview Section */}
        {hasPreviewData && (
          <div css={sectionCSS}>
            <div css={sectionHeaderCSS}>
              <Icon svg={<Icons.FileOutline />} />
              <span>File Preview</span>
              <span>
                {totalRowCount !== null && totalRowCount > previewRows.length
                  ? `(showing ${previewRows.length} of ${totalRowCount} rows)`
                  : `(${previewRows.length} row${previewRows.length === 1 ? "" : "s"})`}
              </span>
            </div>
            <div css={previewTableContainerCSS}>
              <RowPreviewTable
                columns={columns}
                rows={previewRows}
                highlightedColumn={highlightedColumn}
              />
            </div>
          </div>
        )}

        {/* Column Assignment Section */}
        {columns.length > 0 && (
          <div css={sectionCSS}>
            <div css={sectionHeaderCSS}>
              <Icon svg={<Icons.GridOutline />} />
              <span>Assign Columns</span>
            </div>
            <Controller
              name="input_keys"
              control={control}
              rules={{
                validate: (value) =>
                  value.length > 0 || "At least one input column is required",
              }}
              render={({ fieldState: { error } }) => (
                <>
                  <ColumnAssigner
                    columns={columns}
                    value={columnAssignerValue}
                    onChange={handleColumnAssignerChange}
                    onColumnHover={setHighlightedColumn}
                    onReset={handleColumnAssignerReset}
                    fileType={fileType}
                  />
                  {error?.message && (
                    <Text color="danger" size="S">
                      {error.message}
                    </Text>
                  )}
                </>
              )}
            />
          </div>
        )}

        {/* Split key selector */}
        {columns.length > 0 && (
          <div css={sectionCSS}>
            <Controller
              name="split_keys"
              control={control}
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <ColumnMultiSelector
                  label="Split Column (optional)"
                  description={`Select a ${fileType === "csv" ? "column" : "key"} to automatically assign examples to splits`}
                  columns={columns}
                  selectedColumns={value}
                  onChange={onChange}
                  errorMessage={error?.message}
                  isDisabled={isSubmitting || isParsing}
                />
              )}
            />
          </div>
        )}

        {/* Dataset Preview Section */}
        {hasPreviewData && (
          <div css={sectionCSS}>
            <div css={sectionHeaderCSS}>
              <Icon svg={<Icons.DatabaseOutline />} />
              <span>Dataset Preview</span>
            </div>
            <div css={previewTableContainerCSS}>
              <DatasetPreviewTable
                columns={columns}
                rows={previewRows}
                inputColumns={inputKeys}
                outputColumns={outputKeys}
                metadataColumns={metadataKeys}
              />
            </div>
          </div>
        )}
      </div>
    </Form>
  );
}
