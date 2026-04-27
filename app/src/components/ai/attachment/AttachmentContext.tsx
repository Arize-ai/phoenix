import { createContext, useContext } from "react";

import type { AttachmentContextValue } from "./types";

export const AttachmentContext = createContext<AttachmentContextValue | null>(
  null
);

/**
 * Returns the nearest `<Attachment>` context value. Throws if called outside
 * of an `<Attachment>`, since slot components like `<AttachmentPreview>` and
 * `<AttachmentInfo>` require attachment data to render.
 */
export function useAttachmentContext(): AttachmentContextValue {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error(
      "useAttachmentContext must be used within an <Attachment> component"
    );
  }
  return ctx;
}
