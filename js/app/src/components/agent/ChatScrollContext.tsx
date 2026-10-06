import { createContext, useContext } from "react";

export type ChatScrollContextValue = {
  /** Capture an element's viewport position before an expanding reflow. */
  captureAnchor: (element: HTMLElement | null) => void;
  /** Restore the element captured before an expanding reflow. */
  restoreAnchor: (element: HTMLElement | null) => void;
  /** Resume smoothly following the active response. */
  resumeFollowing: () => void;
  /** Place an element near the top of the transcript viewport. */
  scrollElementToTop: (element: HTMLElement | null) => void;
  /** Release automatic scrolling until the user sends or resumes a turn. */
  stopScroll: () => void;
};

export const ChatScrollContext = createContext<ChatScrollContextValue | null>(
  null
);

export function useChatScrollContext(): ChatScrollContextValue | null {
  return useContext(ChatScrollContext);
}
