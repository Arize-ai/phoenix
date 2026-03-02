import { Button } from "@phoenix/components/button";
import { Icon, FileOutline, CloseOutline } from "@phoenix/components/icon";
import { ProgressBar } from "@phoenix/components/progress";

import { formatFileSize } from "./FileDropZone";
import { fileListCSS } from "./styles";
import type { FileListProps, FileWithProgress } from "./types";

/**
 * Returns status text based on file progress status
 */
function getStatusText(file: FileWithProgress): string {
  switch (file.status) {
    case "pending":
      return "Pending";
    case "uploading":
      return `Uploading${file.progress !== undefined ? ` ${file.progress}%` : ""}`;
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "";
  }
}

/**
 * Displays a list of files with optional progress tracking and remove functionality.
 * Intended to be used alongside FileDropZone to show selected files.
 */
export function FileList({ files, onRemove, isDisabled }: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div css={fileListCSS}>
      {files.map((fileWithProgress, index) => {
        const { file, progress, status, error } = fileWithProgress;
        const showProgress = status === "uploading" && progress !== undefined;

        return (
          <div
            key={`${index}-${file.name}-${file.size}-${file.lastModified}`}
            className="file-list__item"
            data-status={status}
          >
            <div className="file-list__icon">
              <Icon svg={<FileOutline />} />
            </div>

            <div className="file-list__details">
              <span className="file-list__name" title={file.name}>
                {file.name}
              </span>
              <div className="file-list__meta">
                <span>{formatFileSize(file.size)}</span>
                {status && (
                  <>
                    <span>-</span>
                    <span>{getStatusText(fileWithProgress)}</span>
                  </>
                )}
              </div>
              {error && <span className="file-list__error">{error}</span>}
              {showProgress && (
                <div className="file-list__progress">
                  <ProgressBar value={progress} width="100%" height="4px" />
                </div>
              )}
            </div>

            {onRemove && (
              <div className="file-list__remove">
                <Button
                  size="S"
                  variant="quiet"
                  aria-label={`Remove ${file.name}`}
                  onPress={() => onRemove(file)}
                  isDisabled={isDisabled || status === "uploading"}
                >
                  <Icon svg={<CloseOutline />} />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
