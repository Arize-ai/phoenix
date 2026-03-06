import { type ChangeEvent, useCallback, useRef } from "react";

import { IconButton } from "@phoenix/components/core/button";
import {
  Icon,
  CloseOutline,
  FolderOutline,
} from "@phoenix/components/core/icon";

import { fileInputCSS } from "./styles";
import type { FileInputProps } from "./types";

/**
 * A compact single-file input with filename display, clear button, and browse button.
 * Designed to be used inside a form, optionally wrapped by a DropZone for drag-and-drop.
 */
export function FileInput({
  file,
  acceptedFileTypes,
  onSelect,
  onClear,
  isDisabled,
  label = "File",
  placeholder = "No file selected",
  children,
  "aria-label": ariaLabel,
}: FileInputProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleBrowse = useCallback(() => {
    if (!isDisabled) {
      hiddenInputRef.current?.click();
    }
  }, [isDisabled]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      onSelect?.(Array.from(e.target.files));
      e.target.value = "";
    },
    [onSelect]
  );

  return (
    <div
      css={fileInputCSS}
      data-disabled={isDisabled || undefined}
      aria-label={ariaLabel}
    >
      <input
        ref={hiddenInputRef}
        type="file"
        accept={acceptedFileTypes?.join(",")}
        onChange={handleInputChange}
        hidden
      />
      {label && <span className="file-input__label">{label}</span>}
      <div
        className="file-input__control"
        data-disabled={isDisabled || undefined}
      >
        {file ? (
          <span className="file-input__name" title={file.name}>
            {file.name}
          </span>
        ) : (
          <span className="file-input__placeholder">{placeholder}</span>
        )}
        <div className="file-input__actions">
          {file && onClear && (
            <IconButton
              size="S"
              aria-label="Clear file"
              onPress={onClear}
              isDisabled={isDisabled}
            >
              <Icon svg={<CloseOutline />} />
            </IconButton>
          )}
          <IconButton
            size="S"
            aria-label="Browse files"
            onPress={handleBrowse}
            isDisabled={isDisabled}
          >
            <Icon svg={<FolderOutline />} />
          </IconButton>
        </div>
      </div>
      {children}
    </div>
  );
}
