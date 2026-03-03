import type { ReactElement, ReactNode } from "react";
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
  status?: "pending" | "uploading" | "complete" | "error";
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

  /**
   * Text for the browse button
   * @default "Browse"
   */
  browseButtonText?: string;
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

  /**
   * Index of the item (for keying when used in a map)
   */
  index?: number;
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
   * Optional render function or component child. When a function, called for each file with (file, index).
   * When a single React element (e.g. <FileListItem />), it is cloned for each file with file, onRemove, isDisabled, and index injected.
   * When omitted, files are rendered with the default FileListItem.
   */
  children?:
    | ((file: FileWithProgress, index: number) => ReactNode)
    | ReactElement<FileListItemProps>;
}
