import { IconButton } from "@phoenix/components/core/button";
import { Icon, FileOutline, CloseOutline } from "@phoenix/components/core/icon";
import { ProgressBar } from "@phoenix/components/core/progress";
import { storageSizeFormatter } from "@phoenix/utils/storageSizeFormatUtils";

import type { FileListItemProps, FileWithProgress } from "./types";

/**
 * Returns status text based on file progress status
 */
function getStatusText(file: FileWithProgress): string {
  switch (file.status) {
    case "pending":
      return "Pending";
    case "uploading":
      return `Uploading${file.progress !== undefined ? ` ${file.progress}%` : ""}`;
    case "parsing":
      return "Parsing...";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "";
  }
}

/**
 * Renders a single file row with optional progress and remove action.
 * Used by FileList by default and can be used as the child component in the render component children pattern.
 */
export function FileListItem({
  file: fileWithProgress,
  onRemove,
  isDisabled,
}: FileListItemProps) {
  const { file, progress, status, error } = fileWithProgress;
  const showProgress = status === "uploading" && progress !== undefined;

  return (
    <li className="file-list__item" data-status={status}>
      <div className="file-list__icon">
        <Icon svg={<FileOutline />} />
      </div>

      <div className="file-list__details">
        <span className="file-list__name" title={file.name}>
          {file.name}
        </span>
        <div className="file-list__meta">
          <span>{storageSizeFormatter(file.size)}</span>
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
          <IconButton
            size="S"
            aria-label={`Remove ${file.name}`}
            onPress={() => onRemove(file)}
            isDisabled={
              isDisabled || status === "uploading" || status === "parsing"
            }
          >
            <Icon svg={<CloseOutline />} />
          </IconButton>
        </div>
      )}
    </li>
  );
}
