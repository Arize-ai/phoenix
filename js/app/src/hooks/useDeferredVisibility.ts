import type { RefCallback } from "react";
import { startTransition, useState } from "react";

export type UseDeferredVisibilityParams = {
  /**
   * Stop observing after the observer first reports the element visible;
   * `isVisible` then stays true. Use when only the first reveal matters.
   */
  once?: boolean;
  /**
   * Margin around the viewport counted as visible (CSS margin shorthand,
   * e.g. `"160px 440px"`), so content starts loading just before it scrolls
   * into view. Nested scroll containers still clip; see `scrollMargin`.
   */
  rootMargin?: string;
  /**
   * Like `rootMargin`, but applied to the clip rects of scrollable ancestors
   * (e.g. a horizontally scrolling strip). Browsers without scrollMargin
   * support ignore it and content mounts exactly on entry.
   */
  scrollMargin?: string;
};

export type DeferredVisibility<T extends Element> = {
  /** Attach to the element whose visibility should be tracked */
  ref: RefCallback<T>;
  /** Whether the element currently intersects the viewport */
  isVisible: boolean;
  /**
   * Whether the element has ever intersected the viewport. Never flips back
   * to false, so it can gate a mount-once deferral without unmounting content
   * that scrolls back out of view.
   */
  hasBeenVisible: boolean;
};

/**
 * Tracks whether an element is (and has ever been) scrolled into view, for
 * deferring expensive content — data-fetching charts, heavy editors — until
 * the user can see it. Works against the viewport and inside nested scroll
 * containers alike.
 */
export function useDeferredVisibility<T extends Element>({
  once = false,
  rootMargin,
  scrollMargin,
}: UseDeferredVisibilityParams = {}): DeferredVisibility<T> {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  if (isVisible && !hasBeenVisible) {
    setHasBeenVisible(true);
  }

  // Ref callback, not an effect: it runs before paint, so elements already
  // in view start loading a frame earlier than the observer's first entries.
  // The rect check ignores ancestor clipping — an element below the fold of
  // a scroll container can still overlap the viewport geometrically — so it
  // is only a hint. `once` mode skips it entirely and waits for the observer
  // to confirm an intersection before it stops watching.
  const ref: RefCallback<T> = (element) => {
    if (element == null) {
      return () => {};
    }
    if (!once) {
      const rect = element.getBoundingClientRect();
      // A zero-size rect means no layout (e.g. a display: none ancestor)
      const hasLayout = rect.width > 0 || rect.height > 0;
      const overlapsViewport =
        rect.bottom >= 0 &&
        rect.top <= window.innerHeight &&
        rect.right >= 0 &&
        rect.left <= window.innerWidth;
      if (hasLayout && overlapsViewport) {
        setIsVisible(true);
      }
    }
    // scrollMargin is not yet in TypeScript's IntersectionObserverInit
    const options: IntersectionObserverInit & { scrollMargin?: string } = {
      rootMargin,
      scrollMargin,
    };
    const observer = new IntersectionObserver((entries) => {
      // Entries are chronological; only the newest reflects current
      // visibility when a fast scroll batches several crossings together.
      const latestEntry = entries[entries.length - 1];
      // Transition so content that suspends on becoming visible (e.g. a
      // chart catching up on a frozen time range) keeps its current render
      // instead of a fallback.
      startTransition(() => setIsVisible(latestEntry.isIntersecting));
      if (once && latestEntry.isIntersecting) {
        observer.disconnect();
      }
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
  };

  return { ref, isVisible, hasBeenVisible };
}
