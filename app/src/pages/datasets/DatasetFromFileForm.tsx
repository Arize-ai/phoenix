import { css } from "@emotion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";

import { authFetch } from "@phoenix/authFetch";
import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  FileDropZone,
  FileList,
  type FileWithProgress,
} from "@phoenix/components/core/dropzone";
import { Tab, TabList, TabPanel, Tabs } from "@phoenix/components/core/tabs";
import { assertUnreachable } from "@phoenix/typeUtils";
import { parseCSVFile } from "@phoenix/utils/csvUtils";
import { formatJSONLError, parseJSONLFile } from "@phoenix/utils/jsonlUtils";
import { isPlainObject, safelyParseJSONString } from "@phoenix/utils/jsonUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import {
  ColumnAssigner,
  type ColumnAssignerValue,
  getAutoAssignment,
  isAutoIdColumn,
  isAutoSplitColumn,
} from "./ColumnAssigner";
import { computeBucketCollapseConflicts } from "./ColumnAssigner/collapseUtils";
import { ColumnSingleSelector } from "./ColumnSingleSelector";
import { DatasetPreviewTable } from "./DatasetPreview";
import { RowPreviewTable } from "./RowPreview";

type AutoAssignmentResult = ColumnAssignerValue & {
  splitKey: string | null;
  exampleIdKey: string | null;
};

/**
 * Auto-assign columns based on name matching heuristics.
 */
function computeAutoAssignment(columns: string[]): AutoAssignmentResult {
  const result: AutoAssignmentResult = {
    input: [],
    output: [],
    metadata: [],
    splitKey: null,
    exampleIdKey: null,
  };
  for (const column of columns) {
    if (isAutoSplitColumn(column)) {
      result.splitKey ??= column; // first match wins
    }
    if (isAutoIdColumn(column)) {
      result.exampleIdKey ??= column; // first match wins
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
  split_key: string | null;
  example_id_key: string | null;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
};

type CreateModeProps = {
  mode: "create";
  onCancel: () => void;
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
};

type AppendModeProps = {
  mode: "append";
  onCancel: () => void;
  datasetName: string;
  onExamplesAdded: () => void;
};

export type DatasetFromFileFormProps = CreateModeProps | AppendModeProps;

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
export function DatasetFromFileForm(props: DatasetFromFileFormProps) {
  const { onCancel, mode } = props;
  const [pendingAction, setPendingAction] = useState<
    "create" | "append" | null
  >(null);
  const isSubmitting = pendingAction !== null;
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
      name: mode === "append" ? props.datasetName : "",
      input_keys: [],
      output_keys: [],
      metadata_keys: [],
      split_key: null,
      example_id_key: null,
      description: "",
      metadata: {},
    },
  });

  const selectedFile = watch("file");
  const inputKeys = watch("input_keys");
  const outputKeys = watch("output_keys");
  const metadataKeys = watch("metadata_keys");
  const splitKey = watch("split_key");
  const exampleIdKey = watch("example_id_key");

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
      resetField("split_key");
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

      if (mode === "create") {
        const name = file.name.replace(/\.(csv|jsonl)$/i, "");
        setValue("name", name, { shouldValidate: true });
      }

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
            setCollapseKeys(result.collapsibleColumns.length > 0);
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
            setValue("split_key", autoAssigned.splitKey, { shouldDirty: true });
            setValue("example_id_key", autoAssigned.exampleIdKey, {
              shouldDirty: true,
            });
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
              setCollapseKeys(result.collapsibleKeys.length > 0);
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
              setValue("split_key", autoAssigned.splitKey, {
                shouldDirty: true,
              });
              setValue("example_id_key", autoAssigned.exampleIdKey, {
                shouldDirty: true,
              });
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
    [resetField, setValue, mode]
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
    resetField("split_key");
    resetField("example_id_key");
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
    setValue("split_key", null, { shouldDirty: true });
    setValue("example_id_key", null, { shouldDirty: true });
  }, [setValue]);

  const handleColumnAssignerAuto = useCallback(() => {
    const autoAssigned = computeAutoAssignment(columns);
    setValue("input_keys", autoAssigned.input, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("output_keys", autoAssigned.output, { shouldDirty: true });
    setValue("metadata_keys", autoAssigned.metadata, { shouldDirty: true });
    setValue("split_key", autoAssigned.splitKey, { shouldDirty: true });
    setValue("example_id_key", autoAssigned.exampleIdKey, {
      shouldDirty: true,
    });
  }, [columns, setValue]);

  const onSubmit = useCallback(
    (data: CreateDatasetFromFileParams, action: "create" | "append") => {
      if (!data.file) {
        return;
      }

      setPendingAction(action);
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

      formData.append("action", action);
      if (mode === "append") {
        formData.append("name", props.datasetName);
      } else if (mode === "create") {
        formData.append("name", data.name);
        formData.append("description", data.description);
        formData.append("metadata", JSON.stringify(data.metadata));
      } else {
        assertUnreachable(mode);
      }
      data.input_keys.forEach((key) => {
        formData.append("input_keys[]", key);
      });
      data.output_keys.forEach((key) => {
        formData.append("output_keys[]", key);
      });
      data.metadata_keys.forEach((key) => {
        formData.append("metadata_keys[]", key);
      });
      if (data.split_key) {
        formData.append("split_key", data.split_key);
      }
      // Send flatten_keys if collapse is enabled
      if (collapseKeys && keysToCollapse.length > 0) {
        keysToCollapse.forEach((key) => {
          formData.append("flatten_keys[]", key);
        });
      }
      if (data.example_id_key) {
        formData.append("example_id_key", data.example_id_key);
      }

      return authFetch(prependBasename("/v1/datasets/upload?sync=true"), {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            return response.text().then((text) => {
              throw new Error(
                text || response.statusText || "Failed to create dataset"
              );
            });
          }
          return response.json();
        })
        .then((res) => {
          if (props.mode === "append") {
            props.onExamplesAdded();
          } else if (mode === "create") {
            props.onDatasetCreated({
              name: data.name,
              id: res["data"]["dataset_id"],
            });
          }
        })
        .catch((error) => {
          const fallback =
            mode === "append"
              ? "Failed to add examples"
              : "Failed to create dataset";
          setErrorMessage(error instanceof Error ? error.message : fallback);
        })
        .finally(() => {
          setPendingAction(null);
        });
    },
    [fileType, collapseKeys, keysToCollapse, mode, props]
  );

  const handleSubmitCreate = handleSubmit((data) => onSubmit(data, "create"));
  const handleSubmitAppend = handleSubmit((data) => onSubmit(data, "append"));

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
    <Form css={formContainerCSS}>
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

        {mode === "create" && (
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
        )}

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
                  <Tab id="dataset">Examples Preview</Tab>
                </TabList>
                <span css={rowCountCSS}>
                  {totalRowCount !== null && totalRowCount > previewRows.length
                    ? `showing ${previewRows.length} of ${totalRowCount} rows`
                    : `${previewRows.length} row${
                        previewRows.length === 1 ? "" : "s"
                      }`}
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
                    splitColumn={splitKey}
                    exampleIdColumn={exampleIdKey}
                  />
                </div>
              </TabPanel>
            </Tabs>
          </div>
        )}

        {columns.length > 0 && (
          <div css={sectionCSS}>
            <Controller
              name="example_id_key"
              control={control}
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <ColumnSingleSelector
                  label="Example ID Column (optional)"
                  description={`Select a ${fileType === "csv" ? "column" : "key"} to use as a unique identifier for upserting examples`}
                  columns={columns}
                  selectedColumn={value}
                  onChange={onChange}
                  errorMessage={error?.message}
                  isDisabled={isSubmitting || isParsing}
                />
              )}
            />
            <Controller
              name="split_key"
              control={control}
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <ColumnSingleSelector
                  label="Split Column (optional)"
                  description={`Select a ${fileType === "csv" ? "column" : "key"} containing split names (plain string or JSON list)`}
                  columns={columns}
                  selectedColumn={value}
                  onChange={onChange}
                  errorMessage={error?.message}
                  isDisabled={isSubmitting || isParsing}
                />
              )}
            />
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
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          variant="default"
          size="S"
          type="button"
          onPress={onCancel}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        {mode === "append" ? (
          <>
            <DialogTrigger>
              <Button
                variant="default"
                size="S"
                type="button"
                isDisabled={!isValid || isSubmitting || isParsing}
                leadingVisual={
                  pendingAction === "create" ? (
                    <Icon svg={<Icons.LoadingOutline />} />
                  ) : undefined
                }
              >
                {pendingAction === "create"
                  ? "Replacing..."
                  : "Replace Examples"}
              </Button>
              <ModalOverlay isDismissable>
                <Modal size="S">
                  <Dialog>
                    {({ close }) => (
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Replace Examples</DialogTitle>
                          <DialogTitleExtra>
                            <DialogCloseButton slot="close" />
                          </DialogTitleExtra>
                        </DialogHeader>
                        <View padding="size-200">
                          <Text color="danger">
                            {`Are you sure you want to replace the examples in this dataset? Any existing examples not present in the uploaded file will be deleted.`}
                          </Text>
                        </View>
                        <View
                          paddingEnd="size-200"
                          paddingTop="size-100"
                          paddingBottom="size-100"
                          borderTopColor="default"
                          borderTopWidth="thin"
                        >
                          <Flex
                            direction="row"
                            justifyContent="end"
                            gap="size-100"
                          >
                            <Button slot="close" size="S">
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              size="S"
                              onPress={() => {
                                close();
                                handleSubmitCreate();
                              }}
                            >
                              Replace Examples
                            </Button>
                          </Flex>
                        </View>
                      </DialogContent>
                    )}
                  </Dialog>
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
            <Button
              variant="primary"
              size="S"
              type="button"
              onPress={() => handleSubmitAppend()}
              isDisabled={!isValid || isSubmitting || isParsing}
              leadingVisual={
                pendingAction === "append" ? (
                  <Icon svg={<Icons.LoadingOutline />} />
                ) : undefined
              }
            >
              {pendingAction === "append" ? "Updating..." : "Update Dataset"}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="S"
            type="button"
            onPress={() => handleSubmitCreate()}
            isDisabled={!isValid || isSubmitting || isParsing}
            leadingVisual={
              pendingAction === "create" ? (
                <Icon svg={<Icons.LoadingOutline />} />
              ) : undefined
            }
          >
            {pendingAction === "create" ? "Creating..." : "Create Dataset"}
          </Button>
        )}
      </DialogFooter>
    </Form>
  );
}
