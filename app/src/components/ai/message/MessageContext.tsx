import { createContext, useContext } from "react";

import type { MessageContextValue } from "./types";

export const MessageContext = createContext<MessageContextValue | null>(null);

/**
 * Returns the nearest {@link MessageContextValue} provided by a
 * {@link Message} ancestor. Throws if called outside of a `<Message>`.
 */
export function useMessageContext(): MessageContextValue {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessageContext must be used within a <Message>");
  }
  return context;
}
