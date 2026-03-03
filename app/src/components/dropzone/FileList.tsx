import { Fragment } from "react";

import { FileListItem } from "./FileListItem";
import { fileListCSS } from "./styles";
import type { FileListProps, FileWithProgress } from "./types";

/**
 * Displays a list of files with optional progress tracking and remove functionality.
 * Intended to be used alongside FileDropZone to show selected files.
 *
 * Supports a render component children pattern:
 * - Omit `children` to use the default FileListItem for each file.
 * - Pass a render function: `children={(file, index) => <FileListItem file={file} onRemove={onRemove} />}`
 * - Pass a single component child to clone per file: `children={<FileListItem />}` (FileList injects file, onRemove, isDisabled, index).
 */
export function FileList({
  files,
  onRemove,
  isDisabled,
  children,
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const getKey = (fileWithProgress: FileWithProgress, index: number) =>
    `${index}-${fileWithProgress.file.name}-${fileWithProgress.file.size}-${fileWithProgress.file.lastModified}`;

  const renderItem = (fileWithProgress: FileWithProgress, index: number) => {
    if (typeof children === "function") {
      return (
        <Fragment key={getKey(fileWithProgress, index)}>
          {children(fileWithProgress, index)}
        </Fragment>
      );
    }
    if (children != null) {
      throw new Error(
        "FileList: children must be a function or null/undefined."
      );
    }
    return (
      <FileListItem
        key={getKey(fileWithProgress, index)}
        file={fileWithProgress}
        onRemove={onRemove}
        isDisabled={isDisabled}
        index={index}
      />
    );
  };

  return (
    <ul css={fileListCSS}>
      {files.map((fileWithProgress, index) =>
        renderItem(fileWithProgress, index)
      )}
    </ul>
  );
}
