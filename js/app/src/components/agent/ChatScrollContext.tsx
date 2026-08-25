import { createContext, useContext } from "react";

export type ChatScrollContextValue = {
  /** Release follow-bottom; nothing scrolls the transcript until re-engaged. */
  stopScroll: () => void;
  /** Re-engage follow-bottom and pin the transcript to the bottom now. */
  scrollToBottom: () => void;
};

export const ChatScrollContext = createContext<ChatScrollContextValue | null>(
  null
);

export function useChatScrollContext(): ChatScrollContextValue | null {
  return useContext(ChatScrollContext);
}
