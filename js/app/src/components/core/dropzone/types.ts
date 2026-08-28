import type { ReactNode } from "react";
import type { DropZoneProps as ReactAriaDropZoneProps } from "react-aria-components";

/**
 * Represents a file with optional upload progress tracking
 */
export interface FileWithProgress {
  /**
   * The file object
   */
  file: File;
  /**
   * Upload progress as a percentage (0-100)
   */
  progress?: number;
  /**
   * Current status of the file
   */
  status?: "pending" | "uploading" | "parsing" | "complete" | "error";
  /**
   * Error message if status is 'error'
   */
  error?: string;
}

export interface FileDropZoneProps extends Pick<
  ReactAriaDropZoneProps,
  "isDisabled" | "aria-label" | "aria-labelledby" | "aria-describedby"
> {
  /**
   * Accepted file types as MIME types or file extensions.
   * Examples: ['text/csv', 'application/json', '.csv', '.json']
   * If not provided, all file types are accepted.
   */
  acceptedFileTypes?: string[];

  /**
   * Whether multiple files can be selected
   * @default false
   */
  allowsMultiple?: boolean;

  /**
   * Maximum number of files that can be selected (only applies when allowsMultiple is true)
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number;

  /**
   * Callback when files are selected (via drop or browse)
   */
  onSelect?: (files: File[]) => void;

  /**
   * Callback when files are rejected (wrong type, too large, etc.)
   */
  onSelectRejected?: (rejections: FileRejection[]) => void;

  /**
   * Label text displayed in the drop zone
   * @default "Drag and drop files here"
   */
  label?: string;

  /**
   * Description text displayed below the label (e.g., accepted file types)
   */
  description?: string;
}

export interface FileRejection {
  file: File;
  reason: "type" | "size" | "count";
  message: string;
}

export interface FileListItemProps {
  /**
   * File with optional progress information
   */
  file: FileWithProgress;

  /**
   * Callback when the file is removed from the list
   */
  onRemove?: (file: File) => void;

  /**
   * Whether the list is in a disabled state
   */
  isDisabled?: boolean;
}

export interface FileListProps {
  /**
   * List of files with optional progress information
   */
  files: FileWithProgress[];

  /**
   * Callback when a file is removed from the list
   */
  onRemove?: (file: File) => void;

  /**
   * Whether the file list is in a disabled state
   */
  isDisabled?: boolean;

  /**
   * Accessible label for the file list
   * @default "Selected files"
   */
  "aria-label"?: string;

  /**
   * Optional render function called for each file with (file, index).
   * When omitted, files are rendered with the default FileListItem.
   */
  children?: (file: FileWithProgress, index: number) => ReactNode;
}

export interface DropOverlayProps {
  /**
   * Text displayed centered in the overlay when a drop target is active.
   * Can also be passed as `children`.
   */
  children?: ReactNode;
}

export interface FileInputProps {
  /**
   * The currently selected file, or null if none
   */
  file: File | null;

  /**
   * Accepted file types as MIME types or file extensions.
   * Examples: ['text/csv', 'application/json', '.csv', '.json']
   */
  acceptedFileTypes?: string[];

  /**
   * Callback when a file is selected via the browse button
   */
  onSelect?: (files: File[]) => void;

  /**
   * Callback when the file is cleared
   */
  onClear?: () => void;

  /**
   * Whether the input is disabled
   */
  isDisabled?: boolean;

  /**
   * Label text displayed above the input
   * @default "File"
   */
  label?: string;

  /**
   * Placeholder text when no file is selected
   * @default "No file selected"
   */
  placeholder?: string;

  /**
   * Slot-based children rendered below the input control.
   * Use `<Text slot="description">` for help text or status messages.
   *
   * @example
   * ```tsx
   * <FileInput file={file} onSelect={handleSelect}>
   *   <Text slot="description">320 examples</Text>
   * </FileInput>
   * ```
   */
  children?: ReactNode;

  /**
   * Accessible label for the file input
   */
  "aria-label"?: string;
}
