import type { FileUIPart, SourceDocumentUIPart } from "ai";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import type { ButtonProps } from "react-aria-components";

import type { DOMProps } from "../../core/types/dom";

/**
 * Visual layout for an `<Attachments>` group and its `<Attachment>` items.
 *
 * - `"grid"` — square thumbnail tiles with an optional remove button overlay.
 *   Suited to image / video previews.
 * - `"inline"` — compact bordered chip with a leading icon and label.
 *   Suited to context pills and other in-flow tokens.
 * - `"list"` — full-width row with a leading thumbnail, name + media type,
 *   and an optional trailing remove button. Suited to file pickers.
 */
export type AttachmentVariant = "grid" | "inline" | "list";

/**
 * High-level category of an attachment, derived from `data.type` and
 * `data.mediaType`. Drives the default icon shown by `<AttachmentPreview>`.
 */
export type AttachmentMediaCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "source"
  | "context"
  | "unknown";

/** A file attachment from the `ai` SDK, augmented with a stable id. */
export type AttachmentFileData = FileUIPart & { id: string };

/** A source-document citation from the `ai` SDK, augmented with a stable id. */
export type AttachmentSourceData = SourceDocumentUIPart & { id: string };

/**
 * A non-removable context attachment.
 *
 * Used to surface ambient state being sent to an agent (e.g. the project /
 * trace / span the user is currently viewing). Rendered without a remove
 * button when the parent `<Attachment>` is given no `onRemove` handler.
 */
export type AttachmentContextData = {
  type: "context";
  id: string;
  /** Visible label, e.g. `"Project"` or `"Trace: 1a2b3c4d…"`. */
  label: string;
  /**
   * Optional category — drives the default icon. Free string so callers can
   * extend with their own categories without changing this union.
   */
  category?: "project" | "trace" | "span" | "span_filter" | (string & {});
  /** Optional explicit icon override that wins over the category default. */
  icon?: ReactNode;
};

/** Discriminated union of every attachment kind the compound understands. */
export type AttachmentData =
  | AttachmentFileData
  | AttachmentSourceData
  | AttachmentContextData;

// ---------------------------------------------------------------------------
// Context values
// ---------------------------------------------------------------------------

export interface AttachmentsContextValue {
  variant: AttachmentVariant;
}

export interface AttachmentContextValue {
  data: AttachmentData;
  mediaCategory: AttachmentMediaCategory;
  variant: AttachmentVariant;
  onRemove?: () => void;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface AttachmentsProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /**
   * Visual layout for the group and its items.
   * @default "grid"
   */
  variant?: AttachmentVariant;
  children: ReactNode;
}

export interface AttachmentProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /** The attachment data — file, source document, or context. */
  data: AttachmentData;
  /**
   * Optional remove handler. When provided, `<AttachmentRemove>` renders a
   * close button. Omit to render a non-removable attachment (e.g. a context
   * pill).
   */
  onRemove?: () => void;
  children: ReactNode;
}

export interface AttachmentPreviewProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /**
   * Optional fallback content rendered when the attachment has no built-in
   * preview (no image / video URL). Defaults to a category icon.
   */
  fallback?: ReactNode;
}

export interface AttachmentInfoProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /**
   * When true, also renders the media type (e.g. `image/png`) under the name.
   * Ignored for context attachments.
   * @default false
   */
  showMediaType?: boolean;
}

export interface AttachmentRemoveProps extends Omit<
  ButtonProps,
  "children" | "className"
> {
  ref?: Ref<HTMLButtonElement>;
  /**
   * Accessible label for the button.
   * @default "Remove attachment"
   */
  label?: string;
  /** Override the default close icon. */
  children?: ReactNode;
  className?: string;
}
