import { createContext, useContext } from "react";

import type { MessageBranchContextValue } from "./types";

export const MessageBranchContext =
  createContext<MessageBranchContextValue | null>(null);

/**
 * Returns the nearest {@link MessageBranchContextValue} provided by a
 * {@link MessageBranch} ancestor. Throws if called outside of a
 * `<MessageBranch>`.
 */
export function useMessageBranchContext(): MessageBranchContextValue {
  const context = useContext(MessageBranchContext);
  if (!context) {
    throw new Error(
      "useMessageBranchContext must be used within a <MessageBranch>"
    );
  }
  return context;
}
