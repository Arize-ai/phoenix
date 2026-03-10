import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useCallback, useState } from "react";
import type { DropItem, FileDropItem } from "react-aria-components";

import {
  FileDropZone,
  FileInput,
  FileList,
  type FileDropZoneProps,
  type FileInputProps,
  type FileWithProgress,
  type FileRejection,
} from "@phoenix/components";
import { Flex, View, Text } from "@phoenix/components";
import { DropOverlay, DropZone } from "@phoenix/components/core/dropzone";

const fileChipCSS = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: var(--ac-global-color-grey-300);
  border-radius: 12px;
  font-size: var(--ac-global-dimension-font-size-75);
  list-style: none;
`;

const fileChipRemoveButtonCSS = css`
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  color: var(--ac-global-text-color-700);
`;

const meta: Meta<typeof FileDropZone> = {
  title: "Core/Media/File Drop Zone",
  component: FileDropZone,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A file drop zone component that combines drag-and-drop with click-to-browse. Clicking anywhere in the zone opens the file dialog.",
      },
    },
  },
  argTypes: {
    acceptedFileTypes: {
      control: { type: "object" },
      description:
        'Accepted file types as MIME types or extensions (e.g., [".csv", "application/json"])',
    },
    allowsMultiple: {
      control: { type: "boolean" },
      description: "Whether multiple files can be selected",
    },
    maxFiles: {
      control: { type: "number" },
      description: "Maximum number of files (when allowsMultiple is true)",
    },
    maxFileSize: {
      control: { type: "number" },
      description: "Maximum file size in bytes",
    },
    label: {
      control: { type: "text" },
      description: "Label text displayed in the drop zone",
    },
    description: {
      control: { type: "text" },
      description: "Description text (e.g., accepted file types)",
    },
    isDisabled: {
      control: { type: "boolean" },
      description: "Whether the drop zone is disabled",
    },
  },
  tags: ["autodocs"],
};

export default meta;

/**
 * Default drop zone that accepts all file types.
 * Click anywhere in the zone to open the file dialog.
 */
export const Default: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <View width="size-6000">
      <FileDropZone
        {...args}
        onSelect={(newFiles) => {
          setFiles(newFiles);
        }}
      />
      {files.length > 0 && (
        <View marginTop="size-200">
          <Text>Selected: {files.map((f) => f.name).join(", ")}</Text>
        </View>
      )}
    </View>
  );
};

Default.args = {};

/**
 * Drop zone that only accepts CSV files
 */
export const CSVOnly: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<File[]>([]);
  const [rejections, setRejections] = useState<FileRejection[]>([]);

  return (
    <View width="size-6000">
      <FileDropZone
        {...args}
        onSelect={(newFiles) => {
          setFiles(newFiles);
          setRejections([]);
        }}
        onSelectRejected={(rejected) => {
          setRejections(rejected);
        }}
      />
      {files.length > 0 && (
        <View marginTop="size-200">
          <Text color="success">
            Accepted: {files.map((f) => f.name).join(", ")}
          </Text>
        </View>
      )}
      {rejections.length > 0 && (
        <View marginTop="size-200">
          <Text color="danger">
            Rejected:{" "}
            {rejections.map((r) => `${r.file.name} (${r.message})`).join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
};

CSVOnly.args = {
  acceptedFileTypes: [".csv", "text/csv"],
  label: "Drop your CSV file here",
};

/**
 * Drop zone that accepts multiple JSON files
 */
export const MultipleJSONFiles: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <View width="size-6000">
      <FileDropZone
        {...args}
        onSelect={(newFiles) => {
          setFiles((prev) => [...prev, ...newFiles]);
        }}
      />
      {files.length > 0 && (
        <View marginTop="size-200">
          <Text>
            Selected {files.length} file(s):{" "}
            {files.map((f) => f.name).join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
};

MultipleJSONFiles.args = {
  acceptedFileTypes: [".json", ".jsonl", "application/json"],
  allowsMultiple: true,
  label: "Drop your JSON/JSONL files here",
};

/**
 * Drop zone with file list showing selected files with remove functionality
 */
export const WithFileList: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);

  const handleSelect = useCallback((newFiles: File[]) => {
    const newFilesWithProgress: FileWithProgress[] = newFiles.map((file) => ({
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newFilesWithProgress]);
  }, []);

  const handleRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) =>
      prev.filter(
        (f) =>
          f.file.name !== fileToRemove.name ||
          f.file.size !== fileToRemove.size ||
          f.file.lastModified !== fileToRemove.lastModified
      )
    );
  }, []);

  return (
    <Flex direction="column" gap="size-200" width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove} />
    </Flex>
  );
};

WithFileList.args = {
  allowsMultiple: true,
  label: "Drop files to add to the list",
};

/**
 * Simulated upload progress demonstration
 */
export const WithUploadProgress: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);

  const simulateUpload = useCallback((file: File) => {
    const newFile: FileWithProgress = {
      file,
      status: "uploading",
      progress: 0,
    };

    setFiles((prev) => [...prev, newFile]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, status: "complete", progress: 100 } : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, progress: Math.round(progress) } : f
          )
        );
      }
    }, 300);
  }, []);

  const handleSelect = useCallback(
    (newFiles: File[]) => {
      newFiles.forEach(simulateUpload);
    },
    [simulateUpload]
  );

  const handleRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== fileToRemove));
  }, []);

  return (
    <Flex direction="column" gap="size-200" width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove} />
    </Flex>
  );
};

WithUploadProgress.args = {
  allowsMultiple: true,
  label: "Drop files to simulate upload",
};

/**
 * FileList with render-function children for full control over each item.
 * Renders compact file chips instead of the default list items to demonstrate
 * the customization power of the render function pattern.
 */
export const FileListWithRenderFunction: StoryFn<FileDropZoneProps> = (
  args
) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);

  const handleSelect = useCallback((newFiles: File[]) => {
    const newFilesWithProgress: FileWithProgress[] = newFiles.map((file) => ({
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newFilesWithProgress]);
  }, []);

  const handleRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) =>
      prev.filter(
        (f) =>
          f.file.name !== fileToRemove.name ||
          f.file.size !== fileToRemove.size ||
          f.file.lastModified !== fileToRemove.lastModified
      )
    );
  }, []);

  return (
    <Flex direction="column" gap="size-200" width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove}>
        {(fileWithProgress) => (
          <li css={fileChipCSS}>
            <span>{fileWithProgress.file.name}</span>
            <button
              onClick={() => handleRemove(fileWithProgress.file)}
              css={fileChipRemoveButtonCSS}
              aria-label={`Remove ${fileWithProgress.file.name}`}
            >
              ×
            </button>
          </li>
        )}
      </FileList>
    </Flex>
  );
};

FileListWithRenderFunction.args = {
  allowsMultiple: true,
  label: "Drop files — renders compact file chips",
};

/**
 * Drop zone with file size limit (1MB)
 */
export const WithSizeLimit: StoryFn<FileDropZoneProps> = (args) => {
  const [files, setFiles] = useState<File[]>([]);
  const [rejections, setRejections] = useState<FileRejection[]>([]);

  return (
    <View width="size-6000">
      <FileDropZone
        {...args}
        onSelect={(newFiles) => {
          setFiles(newFiles);
          setRejections([]);
        }}
        onSelectRejected={(rejected) => {
          setRejections(rejected);
        }}
      />
      {files.length > 0 && (
        <View marginTop="size-200">
          <Text color="success">
            Accepted: {files.map((f) => f.name).join(", ")}
          </Text>
        </View>
      )}
      {rejections.length > 0 && (
        <View marginTop="size-200">
          <Text color="danger">
            Rejected:{" "}
            {rejections.map((r) => `${r.file.name} (${r.message})`).join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
};

WithSizeLimit.args = {
  maxFileSize: 1024 * 1024,
  description: "Maximum file size: 1MB",
};

/**
 * Disabled drop zone
 */
export const Disabled: StoryFn<FileDropZoneProps> = (args) => {
  return (
    <View width="size-6000">
      <FileDropZone {...args} />
    </View>
  );
};

Disabled.args = {
  isDisabled: true,
};

/**
 * Drop zone with custom labels
 */
export const CustomLabels: StoryFn<FileDropZoneProps> = (args) => {
  return (
    <View width="size-6000">
      <FileDropZone {...args} />
    </View>
  );
};

CustomLabels.args = {
  label: "Upload your dataset",
  description: "Supports CSV and JSON formats up to 10MB",
  acceptedFileTypes: [".csv", ".json"],
};

/**
 * Multiple drop zones side by side
 */
export const MultipleSideBySide: StoryFn = () => {
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [outputFiles, setOutputFiles] = useState<File[]>([]);

  return (
    <Flex direction="row" gap="size-200">
      <View width="size-3000">
        <FileDropZone
          label="Input Data"
          acceptedFileTypes={[".csv"]}
          description="CSV files only"
          onSelect={setInputFiles}
        />
        {inputFiles.length > 0 && (
          <View marginTop="size-100">
            <Text>{inputFiles[0].name}</Text>
          </View>
        )}
      </View>
      <View width="size-3000">
        <FileDropZone
          label="Expected Output"
          acceptedFileTypes={[".json"]}
          description="JSON files only"
          onSelect={setOutputFiles}
        />
        {outputFiles.length > 0 && (
          <View marginTop="size-100">
            <Text>{outputFiles[0].name}</Text>
          </View>
        )}
      </View>
    </Flex>
  );
};

/**
 * Compact single-file input with browse and clear buttons.
 */
export const FileInputDefault: StoryFn<FileInputProps> = () => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <View width="size-6000">
      <FileInput
        file={file}
        onSelect={(files) => setFile(files[0] ?? null)}
        onClear={() => setFile(null)}
      />
    </View>
  );
};

FileInputDefault.storyName = "FileInput / Default";

/**
 * FileInput with accepted file types and a description slot.
 */
export const FileInputWithDescription: StoryFn<FileInputProps> = () => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <View width="size-6000">
      <FileInput
        file={file}
        acceptedFileTypes={[".csv", ".jsonl"]}
        onSelect={(files) => setFile(files[0] ?? null)}
        onClear={() => setFile(null)}
      >
        {file ? (
          <Text slot="description" color="success">
            File loaded successfully
          </Text>
        ) : (
          <Text slot="description" color="text-700">
            Accepts CSV and JSONL files
          </Text>
        )}
      </FileInput>
    </View>
  );
};

FileInputWithDescription.storyName = "FileInput / With Description";

/**
 * FileInput in a disabled state with a file pre-selected.
 */
export const FileInputDisabled: StoryFn<FileInputProps> = () => {
  const mockFile = new File(["test"], "dataset.csv", { type: "text/csv" });

  return (
    <View width="size-6000">
      <FileInput file={mockFile} isDisabled />
    </View>
  );
};

FileInputDisabled.storyName = "FileInput / Disabled";

const dropZoneFormCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-300);
  border: 1px solid var(--global-color-gray-200);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-color-gray-50);
`;

/**
 * Composable DropZone + DropOverlay wrapping a form with a FileInput.
 * Drop a file anywhere on the form area to select it, or use the browse button.
 * The overlay label changes depending on whether a file is already selected.
 */
export const DropZoneWithOverlay: StoryFn = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleSelect = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  }, []);

  const handleDrop = useCallback(async (e: { items: DropItem[] }) => {
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
      setFile(files[0]);
    }
  }, []);

  return (
    <View width="size-6000">
      <DropZone onDrop={handleDrop} getDropOperation={() => "copy"}>
        <DropOverlay>
          {file ? "Drop file to replace current" : "Drop file"}
        </DropOverlay>
        <div css={dropZoneFormCSS}>
          <FileInput
            file={file}
            acceptedFileTypes={[".csv", ".json"]}
            onSelect={handleSelect}
            onClear={() => setFile(null)}
          >
            {file ? (
              <Text slot="description" color="success">
                File ready
              </Text>
            ) : (
              <Text slot="description" color="text-700">
                Drop a file anywhere on this form, or browse
              </Text>
            )}
          </FileInput>
          <Text>Other form fields would go here...</Text>
        </div>
      </DropZone>
    </View>
  );
};

DropZoneWithOverlay.storyName = "DropZone / With Overlay";
