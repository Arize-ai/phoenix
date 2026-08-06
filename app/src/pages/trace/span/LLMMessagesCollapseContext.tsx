import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

type LLMMessagesCollapseContextType = {
  /** How many messages the list holds, which is what "the last one" refers to. */
  messageCount: number;

  /** Whether the message at `index` is currently expanded. */
  isMessageOpen: (index: number) => boolean;

  /** Records the open state the reader asked for on a single message. */
  setMessageOpen: (index: number, isOpen: boolean) => void;

  /**
   * Whether every message is currently expanded. Drives the toggle, which
   * offers the expand until there is nothing left to expand — the list starts
   * mostly collapsed, so opening it up is the move a reader reaches for first.
   */
  areAllMessagesExpanded: boolean;

  /** Expands or collapses every message at once. */
  setAllMessagesOpen: (isOpen: boolean) => void;
};

const LLMMessagesCollapseContext =
  createContext<LLMMessagesCollapseContextType | null>(null);

/**
 * Shares the open state of a list of LLM messages between the messages and the
 * control that expands or collapses them all.
 *
 * A conversation sent to a model is mostly history the reader has already seen;
 * what they came for is the last message. So every message starts collapsed
 * except that one, and the reader opens the earlier turns they actually want.
 *
 * Mount one provider per list — the input and output sides of a span each get
 * their own — and remount it when the span changes, so open states never carry
 * over to a different conversation's messages.
 */
export function LLMMessagesCollapseProvider({
  messageCount,
  children,
}: PropsWithChildren<{ messageCount: number }>) {
  const [openStateByIndex, setOpenStateByIndex] = useState<
    Record<number, boolean>
  >({});

  const isMessageOpen = (index: number) =>
    openStateByIndex[index] ?? index === messageCount - 1;

  const setMessageOpen = (index: number, isOpen: boolean) => {
    setOpenStateByIndex((prev) => ({ ...prev, [index]: isOpen }));
  };

  /**
   * Applies a global expand/collapse as a non-urgent update — expanding a long
   * conversation mounts every message's markdown and tool calls at once.
   */
  const setAllMessagesOpen = (isOpen: boolean) => {
    startTransition(() => {
      setOpenStateByIndex(
        Object.fromEntries(
          Array.from({ length: messageCount }, (_, index) => [index, isOpen])
        )
      );
    });
  };

  const areAllMessagesExpanded = Array.from(
    { length: messageCount },
    (_, index) => index
  ).every((index) => isMessageOpen(index));

  return (
    <LLMMessagesCollapseContext.Provider
      value={{
        messageCount,
        isMessageOpen,
        setMessageOpen,
        areAllMessagesExpanded,
        setAllMessagesOpen,
      }}
    >
      {children}
    </LLMMessagesCollapseContext.Provider>
  );
}

/**
 * Returns the open state and actions for a list of LLM messages.
 *
 * @throws Error when called outside of an `LLMMessagesCollapseProvider`.
 */
export function useLLMMessagesCollapse() {
  const context = useContext(LLMMessagesCollapseContext);
  if (context === null) {
    throw new Error(
      "useLLMMessagesCollapse must be used within an LLMMessagesCollapseProvider"
    );
  }
  return context;
}
