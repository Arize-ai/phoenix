import { useAttachmentContext } from "./AttachmentContext";
import { attachmentPreviewCSS } from "./styles";
import type { AttachmentPreviewProps } from "./types";
import { getDefaultAttachmentIcon } from "./utils";

/**
 * Visual preview slot for an `<Attachment>`. Renders an `<img>` for image
 * file attachments, a muted `<video>` for video file attachments, and a
 * category icon for everything else (documents, sources, contexts, unknown).
 *
 * Pass `fallback` to override the default icon.
 */
export function AttachmentPreview({
  ref,
  fallback,
  ...restProps
}: AttachmentPreviewProps) {
  const { data, mediaCategory, variant } = useAttachmentContext();

  const renderContent = () => {
    if (
      data.type === "file" &&
      mediaCategory === "image" &&
      typeof data.url === "string" &&
      data.url
    ) {
      return <img src={data.url} alt={data.filename ?? "Image"} />;
    }
    if (
      data.type === "file" &&
      mediaCategory === "video" &&
      typeof data.url === "string" &&
      data.url
    ) {
      return <video src={data.url} muted />;
    }
    return fallback ?? getDefaultAttachmentIcon(data);
  };

  return (
    <div
      ref={ref}
      css={attachmentPreviewCSS}
      data-variant={variant}
      data-media-category={mediaCategory}
      {...restProps}
    >
      {renderContent()}
    </div>
  );
}
