import type { ReactNode } from "react";

import { Icon, Icons } from "../../core/icon";
import type { AttachmentData, AttachmentMediaCategory } from "./types";

/**
 * Derive the high-level media category for an attachment from its
 * discriminator and (for files) its mediaType.
 */
export function getMediaCategory(
  data: AttachmentData
): AttachmentMediaCategory {
  if (data.type === "context") {
    return "context";
  }
  if (data.type === "source-document") {
    return "source";
  }
  const mediaType = data.mediaType ?? "";
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
    return "document";
  }
  return "unknown";
}

/** Visible label for an attachment, used by `<AttachmentInfo>`. */
export function getAttachmentLabel(data: AttachmentData): string {
  if (data.type === "context") {
    return data.label;
  }
  if (data.type === "source-document") {
    return data.title || data.filename || "Source";
  }
  return (
    data.filename ||
    (getMediaCategory(data) === "image" ? "Image" : "Attachment")
  );
}

/**
 * Optional secondary detail for an attachment (e.g. a context's trace id or
 * filter condition), used by `<AttachmentInfo>`. Only context attachments
 * carry a detail today.
 */
export function getAttachmentDetail(data: AttachmentData): string | undefined {
  return data.type === "context" ? data.detail : undefined;
}

/** Default icon for a context category, used when no `data.icon` is set. */
function getContextCategoryIcon(category: string | undefined): ReactNode {
  switch (category) {
    case "project":
      return <Icon svg={<Icons.Trace />} />;
    case "trace":
      return <Icon svg={<Icons.Trace />} />;
    case "span":
      return <Icon svg={<Icons.WorkflowOutline />} />;
    case "span_filter":
      return <Icon svg={<Icons.FunnelOutline />} />;
    default:
      return <Icon svg={<Icons.InfoOutline />} />;
  }
}

/**
 * Default icon for an attachment, used by `<AttachmentPreview>` when no image
 * or video preview is available.
 */
export function getDefaultAttachmentIcon(data: AttachmentData): ReactNode {
  if (data.type === "context") {
    return data.icon ?? getContextCategoryIcon(data.category);
  }
  switch (getMediaCategory(data)) {
    case "image":
      return <Icon svg={<Icons.ImageOutline />} />;
    case "video":
      return <Icon svg={<Icons.PlayCircleOutline />} />;
    case "audio":
      return <Icon svg={<Icons.FileOutline />} />;
    case "document":
      return <Icon svg={<Icons.FileTextOutline />} />;
    case "source":
      return <Icon svg={<Icons.BookOutline />} />;
    default:
      return <Icon svg={<Icons.FileOutline />} />;
  }
}
