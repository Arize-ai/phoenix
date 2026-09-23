import { Fragment } from "react";

import { FileListItem } from "./FileListItem";
import { fileListCSS } from "./styles";
import type { FileListProps, FileWithProgress } from "./types";

/**
 * Displays a list of files with optional progress tracking and remove functionality.
 * Intended to be used alongside FileDropZone to show selected files.
 *
 * - Omit `children` to use the default FileListItem for each file.
 * - Pass a render function: `children={(file, index) => <FileListItem file={file} onRemove={onRemove} />}`
 */
export function FileList({
  files,
  onRemove,
  isDisabled,
  children,
  "aria-label": ariaLabel = "Selected files",
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const getKey = (fileWithProgress: FileWithProgress) =>
    `${fileWithProgress.file.name}-${fileWithProgress.file.size}-${fileWithProgress.file.lastModified}`;

  const renderItem = (fileWithProgress: FileWithProgress, index: number) => {
    if (children) {
      return (
        <Fragment key={getKey(fileWithProgress)}>
          {children(fileWithProgress, index)}
        </Fragment>
      );
    }
    return (
      <FileListItem
        key={getKey(fileWithProgress)}
        file={fileWithProgress}
        onRemove={onRemove}
        isDisabled={isDisabled}
      />
    );
  };

  return (
    <ul css={fileListCSS} aria-label={ariaLabel}>
      {files.map((fileWithProgress, index) =>
        renderItem(fileWithProgress, index)
      )}
    </ul>
  );
}
