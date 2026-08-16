import { createContext, useContext } from "react";

export type ChatScrollContextValue = {
  stopScroll: () => void;
};

export const ChatScrollContext = createContext<ChatScrollContextValue | null>(
  null
);

export function useChatScrollContext(): ChatScrollContextValue | null {
  return useContext(ChatScrollContext);
}
