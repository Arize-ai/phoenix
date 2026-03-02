import { useCallback } from "react";
import {
  DropZone as ReactAriaDropZone,
  FileTrigger,
  Text,
} from "react-aria-components";
import type { DropItem, FileDropItem } from "react-aria-components";

import { Button } from "@phoenix/components/button";
import { Icon, CloudUpload } from "@phoenix/components/icon";

import { fileDropZoneCSS } from "./styles";
import type { FileDropZoneProps, FileRejection } from "./types";

/**
 * Checks if a file matches the accepted file types.
 * Supports both MIME types (e.g., 'text/csv') and extensions (e.g., '.csv')
 */
function isFileTypeAccepted(file: File, acceptedFileTypes?: string[]): boolean {
  if (!acceptedFileTypes || acceptedFileTypes.length === 0) {
    return true;
  }

  return acceptedFileTypes.some((type) => {
    // Handle extension format (e.g., '.csv')
    if (type.startsWith(".")) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    // Handle MIME type format (e.g., 'text/csv', 'image/*')
    if (type.endsWith("/*")) {
      const baseType = type.slice(0, -2);
      return file.type.startsWith(baseType);
    }
    return file.type === type;
  });
}

/**
 * Validates a file against size constraints
 */
function isFileSizeValid(file: File, maxFileSize?: number): boolean {
  if (!maxFileSize) {
    return true;
  }
  return file.size <= maxFileSize;
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * A file drop zone component that combines drag-and-drop functionality
 * with a file browser button. Built on React Aria's DropZone and FileTrigger.
 */
export function FileDropZone({
  acceptedFileTypes,
  allowsMultiple = false,
  maxFiles,
  maxFileSize,
  onSelect,
  onSelectRejected,
  label = "Drag and drop files here",
  description,
  browseButtonText = "Browse",
  isDisabled,
  ...ariaProps
}: FileDropZoneProps) {
  /**
   * Processes files and separates them into accepted and rejected
   */
  const processFiles = useCallback(
    (files: File[]) => {
      const accepted: File[] = [];
      const rejected: FileRejection[] = [];

      // Check max files constraint
      const maxAllowed = allowsMultiple ? (maxFiles ?? Infinity) : 1;

      files.forEach((file, index) => {
        // Check count limit
        if (index >= maxAllowed) {
          rejected.push({
            file,
            reason: "count",
            message: `Maximum ${maxAllowed} file${maxAllowed > 1 ? "s" : ""} allowed`,
          });
          return;
        }

        // Check file type
        if (!isFileTypeAccepted(file, acceptedFileTypes)) {
          rejected.push({
            file,
            reason: "type",
            message: `File type not accepted. Allowed: ${acceptedFileTypes?.join(", ")}`,
          });
          return;
        }

        // Check file size
        if (!isFileSizeValid(file, maxFileSize)) {
          rejected.push({
            file,
            reason: "size",
            message: `File too large. Maximum size: ${formatFileSize(maxFileSize!)}`,
          });
          return;
        }

        accepted.push(file);
      });

      if (accepted.length > 0 && onSelect) {
        onSelect(accepted);
      }

      if (rejected.length > 0 && onSelectRejected) {
        onSelectRejected(rejected);
      }
    },
    [
      acceptedFileTypes,
      allowsMultiple,
      maxFiles,
      maxFileSize,
      onSelect,
      onSelectRejected,
    ]
  );

  /**
   * Handle files selected via FileTrigger (browse button)
   */
  const handleFileTriggerSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      processFiles(files);
    },
    [processFiles]
  );

  /**
   * Handle files dropped on the DropZone
   */
  const handleDrop = useCallback(
    async (e: { items: DropItem[] }) => {
      // Filter to only file items and get the File objects
      const fileItems = e.items.filter(
        (item): item is FileDropItem => item.kind === "file"
      );

      const files = await Promise.all(fileItems.map((item) => item.getFile()));
      processFiles(files);
    },
    [processFiles]
  );

  /**
   * Determine if dragged items should be accepted
   */
  const getDropOperation = useCallback(
    (types: { has: (type: string) => boolean }) => {
      // If disabled, reject all drops
      if (isDisabled) {
        return "cancel" as const;
      }

      // If no specific types required, accept all files
      if (!acceptedFileTypes || acceptedFileTypes.length === 0) {
        return "copy" as const;
      }

      // Check if any of the dragged types match our accepted types
      // Note: We can only check MIME types during drag, not extensions
      const hasAcceptedType = acceptedFileTypes.some((type) => {
        if (type.startsWith(".")) {
          // Can't check extensions during drag, so allow and validate on drop
          return true;
        }
        if (type.endsWith("/*")) {
          // Check for wildcard MIME types
          const baseType = type.slice(0, -2);
          // Common file types to check
          const commonTypes = [
            `${baseType}/plain`,
            `${baseType}/csv`,
            `${baseType}/json`,
            `${baseType}/xml`,
            `${baseType}/html`,
            `${baseType}/javascript`,
            `${baseType}/png`,
            `${baseType}/jpeg`,
            `${baseType}/gif`,
            `${baseType}/svg+xml`,
            `${baseType}/pdf`,
          ];
          return commonTypes.some((t) => types.has(t));
        }
        return types.has(type);
      });

      return hasAcceptedType ? ("copy" as const) : ("cancel" as const);
    },
    [acceptedFileTypes, isDisabled]
  );

  // Generate description text if not provided
  const displayDescription =
    description ??
    (acceptedFileTypes && acceptedFileTypes.length > 0
      ? `Accepted: ${acceptedFileTypes.join(", ")}`
      : undefined);

  return (
    <ReactAriaDropZone
      css={fileDropZoneCSS}
      onDrop={handleDrop}
      getDropOperation={getDropOperation}
      isDisabled={isDisabled}
      {...ariaProps}
    >
      {({ isDropTarget }) => (
        <>
          <div className="file-drop-zone__icon">
            <Icon svg={<CloudUpload />} />
          </div>
          <Text className="file-drop-zone__label">
            {isDropTarget ? "Drop files here" : label}
          </Text>
          <div className="file-drop-zone__browse-row">
            <Text className="file-drop-zone__or-text">or</Text>
            <FileTrigger
              onSelect={handleFileTriggerSelect}
              acceptedFileTypes={acceptedFileTypes}
              allowsMultiple={allowsMultiple}
            >
              <Button size="S" isDisabled={isDisabled}>
                {browseButtonText}
              </Button>
            </FileTrigger>
          </div>
          {displayDescription && (
            <Text className="file-drop-zone__description">
              {displayDescription}
            </Text>
          )}
        </>
      )}
    </ReactAriaDropZone>
  );
}
