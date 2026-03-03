import type { Meta, StoryFn } from "@storybook/react";
import { useCallback, useState } from "react";

import {
  FileDropZone,
  FileList,
  FileListItem,
  type FileDropZoneProps,
  type FileWithProgress,
  type FileRejection,
} from "@phoenix/components";
import { Flex, View, Text } from "@phoenix/components";

const meta: Meta<typeof FileDropZone> = {
  title: "FileDropZone",
  component: FileDropZone,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A file drop zone component that combines drag-and-drop functionality with a file browser button.",
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
    browseButtonText: {
      control: { type: "text" },
      description: "Text for the browse button",
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
 * Default drop zone that accepts all file types
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
    <View width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove} />
    </View>
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
    // Add file with uploading status
    const newFile: FileWithProgress = {
      file,
      status: "uploading",
      progress: 0,
    };

    setFiles((prev) => [...prev, newFile]);

    // Simulate upload progress
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
    <View width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove} />
    </View>
  );
};

WithUploadProgress.args = {
  allowsMultiple: true,
  label: "Drop files to simulate upload",
};

/**
 * FileList with render-function children for full control over each item.
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
    <View width="size-6000">
      <FileDropZone {...args} onSelect={handleSelect} />
      <FileList files={files} onRemove={handleRemove}>
        {(fileWithProgress, index) => (
          <FileListItem
            file={fileWithProgress}
            onRemove={handleRemove}
            index={index}
          />
        )}
      </FileList>
    </View>
  );
};

FileListWithRenderFunction.args = {
  allowsMultiple: true,
  label: "Drop files — list uses render function per item",
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
  maxFileSize: 1024 * 1024, // 1MB
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
  browseButtonText: "Choose File",
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
