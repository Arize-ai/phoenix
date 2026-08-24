import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { useLLMMessagesSearch } from "./LLMMessagesSearchContext";
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
  const { query, isMatch, activeMessageIndex, navigationCount } =
    useLLMMessagesSearch();
  const [renderedQuery, setRenderedQuery] = useState(query);
  const [renderedNavigationCount, setRenderedNavigationCount] =
    useState(navigationCount);

  // Adjusting the state during render rather than remounting on a `key`: the
  // cards below hold state of their own — which of messages / tools / raw they
  // are showing — that is meant to survive the reader moving between spans.
  const openState = renderedSpanId === spanId ? state : UNTOUCHED;
  if (renderedSpanId !== spanId) {
    setRenderedSpanId(spanId);
    setState(UNTOUCHED);
  }

  // A new query asks a different question, so the answers the reader gave to
  // the old one no longer apply. A message they collapsed while hunting one
  // word should not stay shut when they go looking for another.
  //
  // Starting a search clears the bulk toggle as well. Collapsing everything
  // and then searching is a normal thing to do, and `false` is not nullish, so
  // a standing collapse would sit above the match below it and leave a search
  // marking cards it could never open. Refining a query that is already
  // running leaves the toggle alone, because that collapse was an answer to
  // this search.
  if (renderedQuery !== query) {
    const isNewSearch = renderedQuery.trim() === "" && query.trim() !== "";
    setRenderedQuery(query);
    setState((prev) => ({
      allOpen: isNewSearch ? null : prev.allOpen,
      openStateByIndex: {},
    }));
  }

  // Asking to be taken to a match is a request about that one message, so it
  // opens that card the same way a click would and beats the bulk toggle for it
  // alone. Watches the request count, not which match is current, so
  // stepping back to a card closed since opens it again.
  if (renderedNavigationCount !== navigationCount) {
    setRenderedNavigationCount(navigationCount);
    if (activeMessageIndex >= 0) {
      setState((prev) => ({
        ...prev,
        openStateByIndex: {
          ...prev.openStateByIndex,
          [activeMessageIndex]: true,
        },
      }));
    }
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

  /**
   * A match opens itself: a collapsed card is `display: none`, hidden from the
   * page and the screen reader alike, so a match nobody can see is no use.
   *
   * Ranked below both of the reader's own choices. Search suggests, the reader
   * decides, and the outline marks a match they chose to keep shut.
   */
  const isMessageOpen = (index: number) =>
    openState.openStateByIndex[index] ??
    openState.allOpen ??
    (isMatch(index) || undefined) ??
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
