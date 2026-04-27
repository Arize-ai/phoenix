import { useMemo } from "react";

import { AttachmentsContext } from "./AttachmentsContext";
import { attachmentsCSS } from "./styles";
import type { AttachmentsProps } from "./types";

/**
 * Root container for a group of attachments. Provides the
 * {@link AttachmentsContext} so descendant `<Attachment>` items can read the
 * shared `variant`, and renders a flex container whose layout depends on the
 * variant:
 *
 * - `"grid"` — square thumbnail tiles (default).
 * - `"inline"` — compact bordered chips, ideal for context pills.
 * - `"list"` — full-width rows, ideal for file lists.
 *
 * @example
 * ```tsx
 * <Attachments variant="inline">
 *   <Attachment data={contextData}>
 *     <AttachmentPreview />
 *     <AttachmentInfo />
 *   </Attachment>
 * </Attachments>
 * ```
 */
export function Attachments({
  children,
  ref,
  variant = "grid",
  ...restProps
}: AttachmentsProps) {
  const value = useMemo(() => ({ variant }), [variant]);
  return (
    <AttachmentsContext.Provider value={value}>
      <div ref={ref} css={attachmentsCSS} data-variant={variant} {...restProps}>
        {children}
      </div>
    </AttachmentsContext.Provider>
  );
}
