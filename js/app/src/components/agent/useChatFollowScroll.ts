import { useCallback, useRef } from "react";

/**
 * The transcript's single scroll authority.
 *
 * The chat scroller previously had several independent `scrollTop` writers —
 * a spring-animated stick-to-bottom library (re-armed by its ResizeObserver on
 * every content resize), manual expand/collapse anchoring, a smooth
 * scroll-into-view for approvals, and the browser's native scroll anchoring.
 * Any two of them fighting produced runaway or frozen scrolling: expanding an
 * approval preview resized the content, the library re-armed its retained
 * animation, and its escape hatches never fired (its wheel handler bails when
 * the first `overflow: auto` ancestor under the pointer isn't the scroller —
 * `.tool-part__body` computes to `overflow: auto` — and its scroll handler
 * ignores events while any resize is in flight, which during streaming is
 * nearly always).
 *
 * This hook replaces the library with three invariants:
 *
 * 1. **One writer at a time.** In `follow` mode this hook pins the scroller to
 *    the bottom whenever the content or viewport resizes. In `free` mode it
 *    writes nothing — the user (or a one-shot caller like the expand/collapse
 *    scroll anchor, which first calls {@link stopScroll}) has full control.
 * 2. **Instant writes only.** Programmatic scrolls are single synchronous
 *    `scrollTop` assignments, never multi-frame animations, so there is never
 *    an in-flight animation for a user gesture to race.
 * 3. **Upward intent always wins.** Any wheel-up over the scroller (regardless
 *    of what nested element it targets — wheel events bubble) and any
 *    user-driven upward scroll switch to `free` immediately. Scrolling back
 *    down to the bottom re-engages `follow`.
 *
 * The returned surface matches what the chat view needs: callback refs for the
 * scroller and its content, plus `scrollToBottom` / `stopScroll` controls
 * (`stopScroll` is shared through `ChatScrollContext`).
 */

/**
 * How close (px) to the bottom a user-driven downward scroll must get before
 * follow mode re-engages.
 */
const NEAR_BOTTOM_PX = 40;

type FollowMode = "follow" | "free";

export function useChatFollowScroll(): {
  /** Callback ref for the scrollable element (`overflow-y: auto`). */
  scrollRef: (element: HTMLElement | null) => void;
  /** Callback ref for the content element whose growth should be followed. */
  contentRef: (element: HTMLElement | null) => void;
  /** Re-engage follow mode and pin to the bottom now. */
  scrollToBottom: () => void;
  /** Release follow mode; nothing writes `scrollTop` until re-engaged. */
  stopScroll: () => void;
} {
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const modeRef = useRef<FollowMode>("follow");
  /** Last observed `scrollTop`, for user scroll direction detection. */
  const lastScrollTopRef = useRef<number | null>(null);
  /**
   * The `scrollTop` this hook last wrote. The scroll event a programmatic
   * write produces must not be mistaken for user intent, so the handler
   * swallows the first event landing at this exact position.
   */
  const selfScrollTopRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const pinToBottom = useCallback(() => {
    const element = scrollElementRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight - element.clientHeight;
    // Read back: the browser clamps/rounds the assignment.
    selfScrollTopRef.current = element.scrollTop;
    lastScrollTopRef.current = element.scrollTop;
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollElementRef.current;
    if (!element) {
      return;
    }
    const scrollTop = element.scrollTop;
    const previousScrollTop = lastScrollTopRef.current ?? scrollTop;
    lastScrollTopRef.current = scrollTop;
    if (
      selfScrollTopRef.current !== null &&
      Math.abs(scrollTop - selfScrollTopRef.current) <= 1
    ) {
      // Echo of our own pin — not user intent.
      selfScrollTopRef.current = null;
      return;
    }
    selfScrollTopRef.current = null;
    if (scrollTop < previousScrollTop) {
      // User (or user-initiated momentum) moved up: release immediately.
      modeRef.current = "free";
      return;
    }
    const distanceFromBottom =
      element.scrollHeight - element.clientHeight - scrollTop;
    if (scrollTop > previousScrollTop && distanceFromBottom <= NEAR_BOTTOM_PX) {
      // User scrolled down to the bottom: resume following.
      modeRef.current = "follow";
    }
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    // Absolute escape hatch: a wheel-up anywhere over the transcript releases
    // follow mode, no matter which nested (horizontally) scrollable element
    // the event targets. This is intent, not necessarily movement — the
    // scroll handler alone can miss upward gestures that a same-frame pin
    // would cancel.
    if (event.deltaY < 0) {
      modeRef.current = "free";
    }
  }, []);

  const getResizeObserver = useCallback(() => {
    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        // Content grew/shrank or the viewport resized. Only follow mode may
        // write; free mode leaves the user's position entirely alone.
        if (modeRef.current === "follow") {
          pinToBottom();
        }
      });
    }
    return resizeObserverRef.current;
  }, [pinToBottom]);

  const scrollRef = useCallback(
    (element: HTMLElement | null) => {
      const previous = scrollElementRef.current;
      if (previous) {
        previous.removeEventListener("scroll", handleScroll);
        previous.removeEventListener("wheel", handleWheel);
        resizeObserverRef.current?.unobserve(previous);
      }
      scrollElementRef.current = element;
      lastScrollTopRef.current = element?.scrollTop ?? null;
      if (element) {
        element.addEventListener("scroll", handleScroll, { passive: true });
        element.addEventListener("wheel", handleWheel, { passive: true });
        // Observing the scroller itself keeps the pin correct when the
        // viewport (panel) is resized while following.
        getResizeObserver().observe(element);
      }
    },
    [handleScroll, handleWheel, getResizeObserver]
  );

  const contentElementRef = useRef<HTMLElement | null>(null);
  const contentRef = useCallback(
    (element: HTMLElement | null) => {
      const previous = contentElementRef.current;
      if (previous) {
        resizeObserverRef.current?.unobserve(previous);
      }
      contentElementRef.current = element;
      if (element) {
        getResizeObserver().observe(element);
      }
    },
    [getResizeObserver]
  );

  const scrollToBottom = useCallback(() => {
    modeRef.current = "follow";
    pinToBottom();
  }, [pinToBottom]);

  const stopScroll = useCallback(() => {
    modeRef.current = "free";
  }, []);

  return { scrollRef, contentRef, scrollToBottom, stopScroll };
}
