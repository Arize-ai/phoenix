import { createContext, useContext } from "react";

import type { AttachmentsContextValue } from "./types";

export const AttachmentsContext = createContext<AttachmentsContextValue | null>(
  null
);

/**
 * Read the nearest `<Attachments>` context value. Falls back to the default
 * `"grid"` variant when used outside an `<Attachments>` so that an
 * `<Attachment>` can be rendered standalone.
 */
export function useAttachmentsContext(): AttachmentsContextValue {
  return useContext(AttachmentsContext) ?? { variant: "grid" };
}
