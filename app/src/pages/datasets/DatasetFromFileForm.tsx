import { css } from "@emotion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  DialogFooter,
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
import { Tab, TabList, TabPanel, Tabs } from "@phoenix/components/core/tabs";
import { parseCSVFile } from "@phoenix/utils/csvUtils";
import { formatJSONLError, parseJSONLFile } from "@phoenix/utils/jsonlUtils";
import { isPlainObject, safelyParseJSONString } from "@phoenix/utils/jsonUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import {
  ColumnAssigner,
  type ColumnAssignerValue,
  getAutoAssignment,
  isAutoSplitColumn,
} from "./ColumnAssigner";
import { computeBucketCollapseConflicts } from "./ColumnAssigner/collapseUtils";
import { ColumnMultiSelector } from "./ColumnMultiSelector";
import { DatasetPreviewTable } from "./DatasetPreview";
import { RowPreviewTable } from "./RowPreview";

type AutoAssignmentResult = ColumnAssignerValue & { split: string[] };

/**
 * Auto-assign columns based on name matching heuristics.
 */
function computeAutoAssignment(columns: string[]): AutoAssignmentResult {
  const result: AutoAssignmentResult = {
    input: [],
    output: [],
    metadata: [],
    split: [],
  };
  for (const column of columns) {
    if (isAutoSplitColumn(column)) {
      result.split.push(column);
    }
    const bucket = getAutoAssignment(column);
    if (bucket === "input") {
      result.input.push(column);
    } else if (bucket === "output") {
      result.output.push(column);
    } else if (bucket === "metadata") {
      result.metadata.push(column);
    }
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

export type DatasetFromFileFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onCancel: () => void;
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
/** Maximum file size: 100MB */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const formContainerCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const emptyStateCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: var(--global-dimension-size-200);
  gap: var(--global-dimension-size-200);
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

const previewTableContainerCSS = css`
  border: 1px solid var(--global-color-gray-200);
  height: 300px;
  overflow: auto;
  overscroll-behavior: none;
`;

const previewTabsCSS = css`
  height: auto;
`;

const previewTabHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const previewTabPanelCSS = css`
  height: auto;
  overflow: visible;
  margin-top: -1px;
`;

const rowCountCSS = css`
  font-size: var(--global-font-size-s);
  color: var(--global-text-color-700);
  padding-right: var(--global-dimension-size-100);
`;

/**
 * Form for creating a dataset from a CSV or JSONL file.
 * Shows a large dropzone when no file is selected, then reveals
 * the full form with file preview and column assignment.
 */
export function DatasetFromFileForm({
  onDatasetCreated,
  onCancel,
}: DatasetFromFileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewData>([]);
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null);
  const [fileType, setFileType] = useState<DatasetFileType>(null);
  const [isParsing, setIsParsing] = useState(false);
  const parseGeneration = useRef(0);
  const [previewTab, setPreviewTab] = useState<"file" | "dataset">("file");
  const hasAutoSwitched = useRef(false);
  const [collapsibleKeys, setCollapsibleKeys] = useState<string[]>([]);
  const [collapseKeys, setCollapseKeys] = useState(false);

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

  // Compute the keys that can be flattened within their assigned bucket.
  const { keysToCollapse, collapseConflicts } = useMemo(() => {
    if (!collapseKeys || collapsibleKeys.length === 0) {
      return {
        keysToCollapse: [],
        collapseConflicts: new Map<string, string[]>(),
      };
    }

    // Get preview rows as objects (parse JSON for CSV if needed)
    let objectRows: Record<string, unknown>[];
    if (fileType === "jsonl") {
      objectRows = previewRows as Record<string, unknown>[];
    } else if (fileType === "csv") {
      const csvRows = previewRows as string[][];
      objectRows = csvRows.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          const value = row[idx] ?? "";
          if (collapsibleKeys.includes(col)) {
            const parsed = safelyParseJSONString(value);
            if (isPlainObject(parsed)) {
              obj[col] = parsed;
              return;
            }
          }
          obj[col] = value;
        });
        return obj;
      });
    } else {
      return {
        keysToCollapse: [],
        collapseConflicts: new Map<string, string[]>(),
      };
    }

    // Compute assignment-local flatten conflicts for the current assignments
    const result = computeBucketCollapseConflicts(
      collapsibleKeys,
      { input: inputKeys, output: outputKeys, metadata: metadataKeys },
      objectRows
    );

    return {
      keysToCollapse: result.keysToCollapse,
      collapseConflicts: result.conflicts,
    };
  }, [
    collapseKeys,
    collapsibleKeys,
    columns,
    previewRows,
    fileType,
    inputKeys,
    outputKeys,
    metadataKeys,
  ]);

  // Create controlled value for ColumnAssigner
  const columnAssignerValue: ColumnAssignerValue = {
    input: inputKeys,
    output: outputKeys,
    metadata: metadataKeys,
  };

  const hasAssignments =
    inputKeys.length + outputKeys.length + metadataKeys.length > 0;
  useEffect(() => {
    if (hasAssignments && !hasAutoSwitched.current) {
      setPreviewTab("dataset");
      hasAutoSwitched.current = true;
    }
  }, [hasAssignments]);

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
      setPreviewTab("file");
      setCollapsibleKeys([]);
      setCollapseKeys(false);
      hasAutoSwitched.current = false;

      const detectedType = detectFileType(file.name);
      setFileType(detectedType);

      if (!detectedType) {
        setValue("file", null, { shouldValidate: true });
        resetField("name");
        setErrorMessage(
          "Unsupported file type. Please upload a CSV or JSONL file."
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
            // Single-pass parsing: extracts columns, preview rows, and count
            const result = await parseCSVFile(file, PREVIEW_ROW_COUNT);
            if (generation !== parseGeneration.current) return;
            setColumns(result.columns);
            setPreviewRows(result.previewRows);
            setTotalRowCount(result.totalRowCount);
            setErrorMessage(null);
            // Store collapsible columns for collapse feature
            setCollapsibleKeys(result.collapsibleColumns);
            // Auto-assign columns based on name heuristics
            const autoAssigned = computeAutoAssignment(result.columns);
            setValue("input_keys", autoAssigned.input, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setValue("output_keys", autoAssigned.output, { shouldDirty: true });
            setValue("metadata_keys", autoAssigned.metadata, {
              shouldDirty: true,
            });
            setValue("split_keys", autoAssigned.split, { shouldDirty: true });
          } else if (detectedType === "jsonl") {
            // Single-pass parsing: extracts keys, preview rows, and count
            const result = await parseJSONLFile(file, PREVIEW_ROW_COUNT);
            if (generation !== parseGeneration.current) return;
            if (result.success) {
              setColumns(result.keys);
              setPreviewRows(result.previewRows);
              setTotalRowCount(result.totalRowCount);
              setErrorMessage(null);
              // Store collapsible keys for collapse feature
              setCollapsibleKeys(result.collapsibleKeys);
              // Auto-assign columns based on name heuristics
              const autoAssigned = computeAutoAssignment(result.keys);
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
              setValue("split_keys", autoAssigned.split, { shouldDirty: true });
            } else {
              setColumns([]);
              setPreviewRows([]);
              setTotalRowCount(null);
              setErrorMessage(formatJSONLError(result.error));
            }
          }
        } catch (error) {
          if (generation !== parseGeneration.current) return;
          setColumns([]);
          setPreviewRows([]);
          setTotalRowCount(null);
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to parse file"
          );
        } finally {
          if (generation === parseGeneration.current) {
            setIsParsing(false);
          }
        }
      };
      parseFile();
    },
    [resetField, setValue]
  );

  const handleFileSelect = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelectRejected = useCallback(
    (rejections: { file: File; reason: string; message: string }[]) => {
      if (rejections.length > 0) {
        setErrorMessage(rejections[0].message);
      }
    },
    []
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
    setErrorMessage(null);
    setPreviewTab("file");
    setCollapsibleKeys([]);
    setCollapseKeys(false);
    hasAutoSwitched.current = false;
  }, [setValue, resetField]);

  const handlePreviewTabChange = useCallback((key: React.Key) => {
    setPreviewTab(key as "file" | "dataset");
  }, []);

  const handleColumnAssignerClear = useCallback(() => {
    setValue("input_keys", [], { shouldDirty: true, shouldValidate: true });
    setValue("output_keys", [], { shouldDirty: true });
    setValue("metadata_keys", [], { shouldDirty: true });
    setValue("split_keys", [], { shouldDirty: true });
  }, [setValue]);

  const handleColumnAssignerAuto = useCallback(() => {
    const autoAssigned = computeAutoAssignment(columns);
    setValue("input_keys", autoAssigned.input, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("output_keys", autoAssigned.output, { shouldDirty: true });
    setValue("metadata_keys", autoAssigned.metadata, { shouldDirty: true });
    setValue("split_keys", autoAssigned.split, { shouldDirty: true });
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
      // Send flatten_keys if collapse is enabled
      if (collapseKeys && keysToCollapse.length > 0) {
        keysToCollapse.forEach((key) => {
          formData.append("flatten_keys[]", key);
        });
      }

      return fetch(prependBasename("/v1/datasets/upload?sync=true"), {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((body) => {
                const detail =
                  body && typeof body === "object" && "detail" in body
                    ? body.detail
                    : null;
                throw new Error(
                  typeof detail === "string"
                    ? detail
                    : response.statusText || "Failed to create dataset"
                );
              });
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
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to create dataset"
          );
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    },
    [fileType, onDatasetCreated, collapseKeys, keysToCollapse]
  );

  const hasPreviewData = columns.length > 0 && previewRows.length > 0;

  // Show large dropzone empty state when no file is selected
  if (!selectedFile) {
    return (
      <div css={emptyStateCSS}>
        {errorMessage && (
          <Alert variant="danger" banner>
            {errorMessage}
          </Alert>
        )}
        <FileDropZone
          css={largeDropZoneCSS}
          acceptedFileTypes={ACCEPTED_FILE_TYPES}
          maxFileSize={MAX_FILE_SIZE}
          onSelect={handleFileSelect}
          onSelectRejected={handleFileSelectRejected}
          label="Drop a CSV or JSONL file here"
          description="or click to browse (max 100MB)"
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
    <Form css={formContainerCSS} onSubmit={handleSubmit(onSubmit)}>
      <div css={formBodyCSS}>
        {errorMessage && (
          <Alert variant="danger" banner>
            {errorMessage}
          </Alert>
        )}
        <FileList
          files={[fileListItem]}
          onRemove={handleFileRemove}
          isDisabled={isSubmitting}
        />

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

        {hasPreviewData && (
          <div css={sectionCSS}>
            <Tabs
              css={previewTabsCSS}
              selectedKey={previewTab}
              onSelectionChange={handlePreviewTabChange}
            >
              <div css={previewTabHeaderCSS}>
                <TabList>
                  <Tab id="file">File Preview</Tab>
                  <Tab id="dataset">Dataset Preview</Tab>
                </TabList>
                <span css={rowCountCSS}>
                  {totalRowCount !== null && totalRowCount > previewRows.length
                    ? `showing ${previewRows.length} of ${totalRowCount} rows`
                    : `${previewRows.length} row${previewRows.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <TabPanel css={previewTabPanelCSS} id="file">
                <div css={previewTableContainerCSS}>
                  <RowPreviewTable columns={columns} rows={previewRows} />
                </div>
              </TabPanel>
              <TabPanel css={previewTabPanelCSS} id="dataset">
                <div css={previewTableContainerCSS}>
                  <DatasetPreviewTable
                    columns={columns}
                    rows={previewRows}
                    inputColumns={inputKeys}
                    outputColumns={outputKeys}
                    metadataColumns={metadataKeys}
                    collapseKeys={collapseKeys}
                    keysToCollapse={keysToCollapse}
                  />
                </div>
              </TabPanel>
            </Tabs>
          </div>
        )}

        {columns.length > 0 && (
          <div css={sectionCSS}>
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
                    onClear={handleColumnAssignerClear}
                    onAuto={handleColumnAssignerAuto}
                    fileType={fileType}
                    hasCollapsibleKeys={collapsibleKeys.length > 0}
                    collapseKeys={collapseKeys}
                    onCollapseKeysChange={setCollapseKeys}
                    collapseConflicts={collapseConflicts}
                  />
                  {error?.message && (
                    <Text color="danger" size="S">
                      {error.message}
                    </Text>
                  )}
                </>
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
                  label="Split Column (optional)"
                  description={`Select one or more ${fileType === "csv" ? "column" : "key"}s to automatically assign examples to splits`}
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
      </div>
      <DialogFooter>
        <Button
          variant="default"
          size="S"
          onPress={onCancel}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="S"
          type="submit"
          isDisabled={!isValid || isSubmitting || isParsing}
          leadingVisual={
            isSubmitting ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
          }
        >
          {isSubmitting ? "Creating..." : "Create Dataset"}
        </Button>
      </DialogFooter>
    </Form>
  );
}
