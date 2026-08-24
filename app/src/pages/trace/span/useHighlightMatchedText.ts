import { useEffect } from "react";

import { useLLMMessagesSearch } from "./LLMMessagesSearchContext";

// Two registries rather than one: a range takes the styling of the registry
// holding it, and the match you are standing on has to look different.
const ALL_MATCHES = "llm-message-match";
const ACTIVE_MATCH = "llm-message-match-active";

/**
 * Whether the browser can highlight ranges without touching the DOM.
 *
 * Where it cannot, the message card's own outline still marks which messages
 * matched, so the feature degrades to what it was rather than breaking.
 */
const supportsHighlightApi = () =>
  typeof CSS !== "undefined" &&
  "highlights" in CSS &&
  typeof Highlight !== "undefined";

/** Every range in `root` whose text matches `query`, in document order. */
function findRanges(root: Element, query: string): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node !== null) {
    const text = node.nodeValue ?? "";
    const haystack = text.toLowerCase();
    let from = 0;
    let at = haystack.indexOf(query, from);
    while (at !== -1) {
      const range = new Range();
      range.setStart(node, at);
      range.setEnd(node, at + query.length);
      ranges.push(range);
      from = at + query.length;
      at = haystack.indexOf(query, from);
    }
    node = walker.nextNode();
  }
  return ranges;
}

/**
 * Marks the searched-for text inside the messages that matched it.
 *
 * Painted with the CSS custom highlight API, which marks ranges without
 * touching the DOM, so the shared markdown renderer's output and its syntax
 * colours survive untouched.
 *
 * Only matching messages are marked, so a highlight cannot contradict the
 * outline. Within one, every occurrence is, including tool call arguments that
 * are not themselves searched.
 *
 * @param listRef - the element holding the message list.
 */
export function useHighlightMatchedText(
  listRef: React.RefObject<HTMLElement | null>
) {
  const { query, matchIndices, activeMatchOrdinal } = useLLMMessagesSearch();
  const normalizedQuery = query.trim().toLowerCase();
  const activeMessageIndex =
    activeMatchOrdinal < 0 ? -1 : (matchIndices[activeMatchOrdinal] ?? -1);

  useEffect(() => {
    const clearHighlights = () => {
      if (!supportsHighlightApi()) {
        return;
      }
      CSS.highlights.delete(ALL_MATCHES);
      CSS.highlights.delete(ACTIVE_MATCH);
    };

    const list = listRef.current;
    if (!supportsHighlightApi() || list === null || normalizedQuery === "") {
      clearHighlights();
      return clearHighlights;
    }

    const paint = () => {
      const other: Range[] = [];
      const active: Range[] = [];
      list.querySelectorAll("[data-message-index]").forEach((item) => {
        if (!item.classList.contains("llm-message--match")) {
          return;
        }
        const isActive =
          Number(item.getAttribute("data-message-index")) ===
          activeMessageIndex;
        // A collapsed card is `display: none`, so its ranges have no boxes to
        // paint and are skipped rather than silently doing nothing
        const body = item.querySelector(".card__body");
        if (body === null) {
          return;
        }
        (isActive ? active : other).push(...findRanges(body, normalizedQuery));
      });
      CSS.highlights.set(ALL_MATCHES, new Highlight(...other));
      CSS.highlights.set(ACTIVE_MATCH, new Highlight(...active));
    };

    paint();

    // A range points at the text node it was built over, and the rendered
    // message is not ours -- a card opening, a turn flipping between Text and
    // Markdown -- so rather than enumerate what can replace those nodes, watch
    // and rebuild. Painting goes through the CSS API and does not touch the
    // DOM, so this cannot drive itself. Work is coalesced onto a frame.
    let queued: number | null = null;
    const observer = new MutationObserver(() => {
      if (queued !== null) {
        return;
      }
      queued = requestAnimationFrame(() => {
        queued = null;
        paint();
      });
    });
    observer.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (queued !== null) {
        cancelAnimationFrame(queued);
      }
      clearHighlights();
    };
    // `matchIndices` is in the deps so that a query matching the same messages
    // in a different order, or a span whose messages changed underneath an
    // unchanged query, repaints. Which messages are open is not in the deps
    // and does not need to be. The observer above covers it.
  }, [listRef, normalizedQuery, activeMessageIndex, matchIndices]);
}
