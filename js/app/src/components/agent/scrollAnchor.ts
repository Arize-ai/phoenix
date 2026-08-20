import { useCallback, useRef } from "react";

import { useChatScrollContext } from "./ChatScrollContext";

/**
 * Walks up the DOM from `element` to find the closest ancestor that can scroll
 * vertically — i.e. one whose `overflow-y` is `auto`/`scroll` and whose content
 * actually overflows. This is the container we want to move when revealing or
 * resizing a descendant, rather than letting the browser scroll every ancestor.
 *
 * @param element - The element whose scroll container to locate.
 * @returns The nearest vertically scrollable ancestor, or `null` if none exists.
 */
export function getScrollableParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    const isScrollable = overflowY === "auto" || overflowY === "scroll";
    if (isScrollable && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Scroll anchoring for expand/collapse interactions inside the chat transcript.
 *
 * `capture(element)` records where `element` sits within its scroll container
 * just before its content grows or shrinks; `restore(element)` — run after the
 * DOM updates — scrolls the container so the element stays visually put.
 *
 * `capture` always stops the stick-to-bottom controller, even when no scroll
 * container is overflowing yet. Expanding a section can be precisely what first
 * creates the overflow; if we gated the stop on finding a scrollable ancestor
 * (as an earlier version did), the controller would snap the transcript to the
 * bottom in that case and fight the restore. Stopping unconditionally keeps a
 * single, predictable policy for both the tool disclosure and inner sections.
 */
export function useScrollAnchor() {
  const chatScrollContext = useChatScrollContext();
  const anchorRef = useRef<{
    scrollParent: HTMLElement;
    offsetFromParentTop: number;
  } | null>(null);

  const capture = useCallback(
    (element: HTMLElement | null) => {
      // Stop stick-to-bottom unconditionally — see the note above for why this
      // must run even before we know whether a scroll container exists.
      chatScrollContext?.stopScroll();
      anchorRef.current = null;
      if (!element) {
        return;
      }
      const scrollParent = getScrollableParent(element);
      if (!scrollParent) {
        // Nothing is scrolling yet, so there is no position to anchor against;
        // the element keeps its place naturally once the content grows.
        return;
      }
      const elementRect = element.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      anchorRef.current = {
        scrollParent,
        offsetFromParentTop: elementRect.top - parentRect.top,
      };
    },
    [chatScrollContext]
  );

  const restore = useCallback((element: HTMLElement | null) => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!anchor || !element) {
      return;
    }
    const { scrollParent, offsetFromParentTop } = anchor;
    const newElementRect = element.getBoundingClientRect();
    const newParentRect = scrollParent.getBoundingClientRect();
    const newOffsetFromParentTop = newElementRect.top - newParentRect.top;
    scrollParent.scrollTop += newOffsetFromParentTop - offsetFromParentTop;
  }, []);

  return { capture, restore };
}
