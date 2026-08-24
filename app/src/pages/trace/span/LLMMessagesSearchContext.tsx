import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { messageMatchesQuery } from "./utils";

/** No match is current until the reader asks to be taken to one. */
const NO_ACTIVE_MATCH = -1;

// Shared empties, so an idle search hands consumers the same references every
// render rather than fresh ones that invalidate the value memo below
const EMPTY_MATCHES: number[] = [];
const EMPTY_MATCH_SET: ReadonlySet<number> = new Set();

type LLMMessagesSearchContextType = {
  /** The query as typed, before trimming. What the field shows. */
  query: string;
  setQuery: (query: string) => void;

  /** The indices of matching messages, in the order they appear in the list. */
  matchIndices: number[];

  /**
   * Which match the reader is on, as a position within
   * {@link LLMMessagesSearchContextType.matchIndices}, or -1 before they have
   * asked to go anywhere.
   */
  activeMatchOrdinal: number;

  /** Whether the message at `index` matches the current query. */
  isMatch: (index: number) => boolean;

  /** Whether the message at `index` is the match the reader is currently on. */
  isActiveMatch: (index: number) => boolean;

  /**
   * Where the reader currently is in the list, or -1 before they have moved.
   *
   * The collapse state reads this so that being taken to a match opens it.
   */
  activeMessageIndex: number;

  /**
   * The message the reader is currently on, or null before they have moved.
   *
   * Exposed so the search control can say which message it took them to. The
   * scroll and the highlight only reach a reader who can see them. A screen
   * reader has the announcement and nothing else.
   */
  activeMessage: AttributeMessage | null;

  /** Moves to the next match, wrapping past the last one. */
  goToNextMatch: () => void;

  /** Moves to the previous match, wrapping past the first one. */
  goToPreviousMatch: () => void;

  /**
   * The span these messages belong to. The search field is uncontrolled, so a
   * caller keys it on this to get a fresh, empty field when the reader moves to
   * another span, rather than one still showing a query that no longer applies.
   */
  spanId: string;

  /**
   * How many times the reader has asked to move. The announcement watches this,
   * because stepping to the only match leaves the readout saying what it said
   * before, and a live region set to the text it already holds stays silent.
   */
  navigationCount: number;
};

/**
 * Not searching is a legitimate state rather than a mistake, so the default is
 * an inert search instead of null. A message list mounted without the provider
 * -- a test exercising collapse on its own, or a caller that has no need of a
 * search -- keeps working, and the collapse state can read this without having
 * to care whether a search exists.
 */
const INERT: LLMMessagesSearchContextType = {
  query: "",
  setQuery: () => {},
  matchIndices: [],
  activeMatchOrdinal: NO_ACTIVE_MATCH,
  isMatch: () => false,
  isActiveMatch: () => false,
  activeMessageIndex: NO_ACTIVE_MATCH,
  activeMessage: null,
  goToNextMatch: () => {},
  goToPreviousMatch: () => {},
  spanId: "",
  navigationCount: 0,
};

const LLMMessagesSearchContext =
  createContext<LLMMessagesSearchContextType>(INERT);

/**
 * Holds the search over a list of LLM messages: the query, which messages match
 * it, and which match the reader is on.
 *
 * Matches come from the messages rather than the rendered list, which only ever
 * contains the cards that are already open. Mount one per list, outside that
 * list's collapse provider, so collapse can open the match stepping lands on.
 */
export function LLMMessagesSearchProvider({
  messages,
  spanId,
  children,
}: PropsWithChildren<{
  messages: AttributeMessage[];
  /** The span the messages belong to. Reading a different span starts over. */
  spanId: string;
}>) {
  const [query, setQueryState] = useState("");
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState(NO_ACTIVE_MATCH);
  const [navigationCount, setNavigationCount] = useState(0);
  const [renderedSpanId, setRenderedSpanId] = useState(spanId);

  // Adjusting during render rather than remounting on a `key`, the same way the
  // collapse state handles a span change: the cards below hold state of their
  // own that is meant to survive the reader moving between spans.
  if (renderedSpanId !== spanId) {
    setRenderedSpanId(spanId);
    setQueryState("");
    setActiveMatchOrdinal(NO_ACTIVE_MATCH);
  }
  const activeQuery = renderedSpanId === spanId ? query : "";

  // Both shapes come out of one pass: the list carries the order stepping
  // needs, the set answers the "is this one a match" asked once per message
  // per render, and once more for every message whenever the collapse state
  // works out whether they are all open.
  const { matchIndices, matchIndexSet } = useMemo(() => {
    const normalizedQuery = activeQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return { matchIndices: EMPTY_MATCHES, matchIndexSet: EMPTY_MATCH_SET };
    }
    const indices = messages.reduce<number[]>((found, message, index) => {
      if (messageMatchesQuery(message, normalizedQuery)) {
        found.push(index);
      }
      return found;
    }, []);
    return { matchIndices: indices, matchIndexSet: new Set(indices) };
  }, [messages, activeQuery]);

  /**
   * A new query means the old position is meaningless, so the reader starts
   * again with no match current. This is also what keeps typing from moving the
   * page: the scroll follows the active match, and typing does not set one.
   */
  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery);
    setActiveMatchOrdinal(NO_ACTIVE_MATCH);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (matchIndices.length === 0) {
        return;
      }
      setNavigationCount((count) => count + 1);
      setActiveMatchOrdinal((previous) => {
        // From nowhere, forward lands on the first match and backward on the
        // last, which is how a find bar behaves before you have moved
        if (previous === NO_ACTIVE_MATCH) {
          return delta > 0 ? 0 : matchIndices.length - 1;
        }
        return (previous + delta + matchIndices.length) % matchIndices.length;
      });
    },
    [matchIndices]
  );

  const activeMessageIndex =
    activeMatchOrdinal === NO_ACTIVE_MATCH
      ? NO_ACTIVE_MATCH
      : (matchIndices[activeMatchOrdinal] ?? NO_ACTIVE_MATCH);

  const value = useMemo<LLMMessagesSearchContextType>(
    () => ({
      query: activeQuery,
      setQuery,
      matchIndices,
      activeMatchOrdinal,
      isMatch: (index) => matchIndexSet.has(index),
      isActiveMatch: (index) => index === activeMessageIndex,
      activeMessageIndex,
      activeMessage:
        activeMessageIndex === NO_ACTIVE_MATCH
          ? null
          : (messages[activeMessageIndex] ?? null),
      goToNextMatch: () => step(1),
      goToPreviousMatch: () => step(-1),
      spanId,
      navigationCount,
    }),
    [
      activeQuery,
      setQuery,
      matchIndices,
      matchIndexSet,
      activeMatchOrdinal,
      activeMessageIndex,
      messages,
      step,
      spanId,
      navigationCount,
    ]
  );

  return (
    <LLMMessagesSearchContext.Provider value={value}>
      {children}
    </LLMMessagesSearchContext.Provider>
  );
}

/**
 * Returns the search state for a list of LLM messages. Outside a provider it
 * reports an inert search rather than throwing, since a list with no search
 * over it is a normal thing to render.
 */
export function useLLMMessagesSearch() {
  return useContext(LLMMessagesSearchContext);
}
