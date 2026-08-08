import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { getMessagePreview } from "./utils";

type MessagesOpenState = {
  /**
   * The state a bulk expand/collapse put the list in, or null when the reader
   * has not used the toggle. Held for the list as a whole rather than as an
   * entry per message so that a message arriving later — a span still being
   * written — follows the reader's last choice instead of its own default.
   */
  allOpen: boolean | null;

  /**
   * The state the reader chose on individual messages, which wins over
   * {@link MessagesOpenState.allOpen}.
   */
  openStateByIndex: Record<number, boolean>;
};

const UNTOUCHED: MessagesOpenState = { allOpen: null, openStateByIndex: {} };

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
 * what they came for is the last message. So a message starts collapsed unless
 * it is the last one, and the reader opens the earlier turns they actually
 * want.
 *
 * Mount one provider per list — the input and output sides of a span each get
 * their own.
 */
export function LLMMessagesCollapseProvider({
  messages,
  spanId,
  children,
}: PropsWithChildren<{
  messages: AttributeMessage[];
  /** The span the messages belong to. Reading a different span starts over. */
  spanId: string;
}>) {
  const [state, setState] = useState<MessagesOpenState>(UNTOUCHED);
  const [renderedSpanId, setRenderedSpanId] = useState(spanId);

  // Adjusting the state during render rather than remounting on a `key`: the
  // cards below hold state of their own — which of messages / tools / raw they
  // are showing — that is meant to survive the reader moving between spans.
  const openState = renderedSpanId === spanId ? state : UNTOUCHED;
  if (renderedSpanId !== spanId) {
    setRenderedSpanId(spanId);
    setState(UNTOUCHED);
  }

  /**
   * Whether a message the reader has not touched shows itself.
   *
   * A message with no preview has nothing to stand in for its body while
   * collapsed — an image-only turn previews as nothing at all — so collapsing
   * it would leave a bare role header and hide the only content it carries.
   */
  const isOpenByDefault = (index: number) =>
    index === messages.length - 1 || getMessagePreview(messages[index]) == null;

  const isMessageOpen = (index: number) =>
    openState.openStateByIndex[index] ??
    openState.allOpen ??
    isOpenByDefault(index);

  const setMessageOpen = (index: number, isOpen: boolean) => {
    setState((prev) => ({
      ...prev,
      openStateByIndex: { ...prev.openStateByIndex, [index]: isOpen },
    }));
  };

  const setAllMessagesOpen = (isOpen: boolean) => {
    setState({ allOpen: isOpen, openStateByIndex: {} });
  };

  const areAllMessagesExpanded = messages.every((_, index) =>
    isMessageOpen(index)
  );

  return (
    <LLMMessagesCollapseContext.Provider
      value={{
        messageCount: messages.length,
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
