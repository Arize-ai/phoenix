import { css } from "@emotion/react";
import type { StoryObj, Meta, StoryFn } from "@storybook/react";
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

function DefaultRender(args: FileDropZoneProps) {
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
}

export const Default: StoryObj<FileDropZoneProps> = {
  render: DefaultRender,

  args: {},
};

function CSVOnlyRender(args: FileDropZoneProps) {
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
}

export const CSVOnly: StoryObj<FileDropZoneProps> = {
  render: CSVOnlyRender,

  args: {
    acceptedFileTypes: [".csv", "text/csv"],
    label: "Drop your CSV file here",
  },
};

function MultipleJSONFilesRender(args: FileDropZoneProps) {
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
}

export const MultipleJSONFiles: StoryObj<FileDropZoneProps> = {
  render: MultipleJSONFilesRender,

  args: {
    acceptedFileTypes: [".json", ".jsonl", "application/json"],
    allowsMultiple: true,
    label: "Drop your JSON/JSONL files here",
  },
};

function WithFileListRender(args: FileDropZoneProps) {
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
}

export const WithFileList: StoryObj<FileDropZoneProps> = {
  render: WithFileListRender,

  args: {
    allowsMultiple: true,
    label: "Drop files to add to the list",
  },
};

function WithUploadProgressRender(args: FileDropZoneProps) {
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
}

export const WithUploadProgress: StoryObj<FileDropZoneProps> = {
  render: WithUploadProgressRender,

  args: {
    allowsMultiple: true,
    label: "Drop files to simulate upload",
  },
};

function FileListWithRenderFunctionRender(args: FileDropZoneProps) {
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
}

export const FileListWithRenderFunction: StoryObj<FileDropZoneProps> = {
  render: FileListWithRenderFunctionRender,

  args: {
    allowsMultiple: true,
    label: "Drop files — renders compact file chips",
  },
};

function WithSizeLimitRender(args: FileDropZoneProps) {
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
}

export const WithSizeLimit: StoryObj<FileDropZoneProps> = {
  render: WithSizeLimitRender,

  args: {
    maxFileSize: 1024 * 1024,
    description: "Maximum file size: 1MB",
  },
};

export const Disabled: StoryObj<FileDropZoneProps> = {
  render: (args) => {
    return (
      <View width="size-6000">
        <FileDropZone {...args} />
      </View>
    );
  },

  args: {
    isDisabled: true,
  },
};

export const CustomLabels: StoryObj<FileDropZoneProps> = {
  render: (args) => {
    return (
      <View width="size-6000">
        <FileDropZone {...args} />
      </View>
    );
  },

  args: {
    label: "Upload your dataset",
    description: "Supports CSV and JSON formats up to 10MB",
    acceptedFileTypes: [".csv", ".json"],
  },
};

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

function FileInputDefaultRender() {
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
}

export const FileInputDefault: StoryObj<FileInputProps> = {
  render: FileInputDefaultRender,

  name: "FileInput / Default",
};

function FileInputWithDescriptionRender() {
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
}

export const FileInputWithDescription: StoryObj<FileInputProps> = {
  render: FileInputWithDescriptionRender,

  name: "FileInput / With Description",
};

export const FileInputDisabled: StoryObj<FileInputProps> = {
  render: () => {
    const mockFile = new File(["test"], "dataset.csv", { type: "text/csv" });

    return (
      <View width="size-6000">
        <FileInput file={mockFile} isDisabled />
      </View>
    );
  },

  name: "FileInput / Disabled",
};

const dropZoneFormCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-300);
  border: 1px solid var(--global-color-gray-200);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-color-gray-50);
`;

function DropZoneWithOverlayRender() {
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
}

export const DropZoneWithOverlay: StoryObj = {
  render: DropZoneWithOverlayRender,

  name: "DropZone / With Overlay",
};
