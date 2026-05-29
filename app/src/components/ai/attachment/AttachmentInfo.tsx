import { useAttachmentContext } from "./AttachmentContext";
import { attachmentInfoCSS } from "./styles";
import type { AttachmentInfoProps } from "./types";
import { getAttachmentDetail, getAttachmentLabel } from "./utils";

/**
 * Text info slot for an `<Attachment>`. Renders the attachment label, an
 * optional dimmed detail beside it (e.g. a context's trace id), and — when
 * `showMediaType` is set — the media type beneath it.
 *
 * Renders nothing in the `"grid"` variant — grid tiles are image-only.
 */
export function AttachmentInfo({
  ref,
  showMediaType = false,
  ...restProps
}: AttachmentInfoProps) {
  const { data, variant } = useAttachmentContext();

  if (variant === "grid") {
    return null;
  }

  const label = getAttachmentLabel(data);
  const detail = getAttachmentDetail(data);
  const mediaType =
    data.type === "file" || data.type === "source-document"
      ? data.mediaType
      : undefined;

  return (
    <div
      ref={ref}
      css={attachmentInfoCSS}
      className={
        detail
          ? "attachment-info attachment-info--with-detail"
          : "attachment-info"
      }
      {...restProps}
    >
      <span className="attachment-info__label">{label}</span>
      {detail ? (
        <span className="attachment-info__detail">{detail}</span>
      ) : null}
      {showMediaType && mediaType ? (
        <span className="attachment-info__media-type">{mediaType}</span>
      ) : null}
    </div>
  );
}
