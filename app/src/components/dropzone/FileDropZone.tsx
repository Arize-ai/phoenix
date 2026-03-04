import { type ChangeEvent, useCallback, useRef } from "react";
import { DropZone as ReactAriaDropZone, Text } from "react-aria-components";
import type { DropItem, FileDropItem } from "react-aria-components";

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
    if (type.startsWith(".")) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
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
  if (maxFileSize == null) {
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
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * A file drop zone component that combines drag-and-drop with click-to-browse.
 * Clicking anywhere in the zone opens the file dialog.
 * Built on React Aria's DropZone.
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
  isDisabled,
  ...ariaProps
}: FileDropZoneProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (files: File[]) => {
      const accepted: File[] = [];
      const rejected: FileRejection[] = [];
      const maxAllowed = allowsMultiple ? (maxFiles ?? Infinity) : 1;

      for (const file of files) {
        if (!isFileTypeAccepted(file, acceptedFileTypes)) {
          rejected.push({
            file,
            reason: "type",
            message: `File type not accepted. Allowed: ${acceptedFileTypes?.join(", ")}`,
          });
          continue;
        }

        if (!isFileSizeValid(file, maxFileSize)) {
          rejected.push({
            file,
            reason: "size",
            message: `File too large. Maximum size: ${formatFileSize(maxFileSize!)}`,
          });
          continue;
        }

        if (accepted.length >= maxAllowed) {
          rejected.push({
            file,
            reason: "count",
            message: `Maximum ${maxAllowed} file${maxAllowed > 1 ? "s" : ""} allowed`,
          });
          continue;
        }

        accepted.push(file);
      }

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

  const handleHiddenInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    async (e: { items: DropItem[] }) => {
      const fileItems = e.items.filter(
        (item): item is FileDropItem => item.kind === "file"
      );

      const files = await Promise.all(fileItems.map((item) => item.getFile()));
      processFiles(files);
    },
    [processFiles]
  );

  const getDropOperation = useCallback(
    (types: { has: (type: string) => boolean }) => {
      if (isDisabled) {
        return "cancel" as const;
      }

      if (!acceptedFileTypes || acceptedFileTypes.length === 0) {
        return "copy" as const;
      }

      const hasAcceptedType = acceptedFileTypes.some((type) => {
        if (type.startsWith(".")) {
          return true;
        }
        if (type.endsWith("/*")) {
          return true;
        }
        return types.has(type);
      });

      return hasAcceptedType ? ("copy" as const) : ("cancel" as const);
    },
    [acceptedFileTypes, isDisabled]
  );

  const openFileDialog = useCallback(() => {
    if (!isDisabled) {
      hiddenInputRef.current?.click();
    }
  }, [isDisabled]);

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
          <input
            ref={hiddenInputRef}
            type="file"
            accept={acceptedFileTypes?.join(",")}
            multiple={allowsMultiple}
            onChange={handleHiddenInputChange}
            hidden
          />
          <div
            className="file-drop-zone__trigger"
            onClick={openFileDialog}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFileDialog();
              }
            }}
            role="button"
            tabIndex={isDisabled ? undefined : 0}
          >
            <div className="file-drop-zone__icon">
              <Icon svg={<CloudUpload />} />
            </div>
            <Text className="file-drop-zone__label">
              {isDropTarget ? "Drop files here" : label}
            </Text>
            {displayDescription && (
              <Text className="file-drop-zone__description">
                {displayDescription}
              </Text>
            )}
          </div>
        </>
      )}
    </ReactAriaDropZone>
  );
}
