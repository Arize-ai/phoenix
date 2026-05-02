import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts/ThemeContext";

import { AttachmentContext } from "./AttachmentContext";
import { useAttachmentsContext } from "./AttachmentsContext";
import { attachmentCSS } from "./styles";
import type { AttachmentContextValue, AttachmentProps } from "./types";
import { getMediaCategory } from "./utils";

/**
 * A single attachment within an `<Attachments>` group. Provides per-item
 * context to slot components (`<AttachmentPreview>`, `<AttachmentInfo>`,
 * `<AttachmentRemove>`).
 *
 * Pass `onRemove` to render a removable attachment. Omit it for non-removable
 * attachments such as context pills.
 */
export function Attachment({
  children,
  ref,
  data,
  onRemove,
  ...restProps
}: AttachmentProps) {
  const { variant } = useAttachmentsContext();
  const { theme } = useTheme();
  const mediaCategory = getMediaCategory(data);

  const value = useMemo<AttachmentContextValue>(
    () => ({ data, mediaCategory, variant, onRemove }),
    [data, mediaCategory, variant, onRemove]
  );

  return (
    <AttachmentContext.Provider value={value}>
      <div
        ref={ref}
        css={attachmentCSS}
        data-attachment=""
        data-variant={variant}
        data-theme={theme}
        {...restProps}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
}
