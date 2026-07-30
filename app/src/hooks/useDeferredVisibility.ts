import type { RefCallback } from "react";
import { createContext, startTransition, useContext, useState } from "react";

export type UseDeferredVisibilityParams = {
  /**
   * Stop observing after the element is first seen; `isVisible` (and so
   * `hasBeenVisible`) then stays true. Use for mount-once deferral where
   * later exits from the viewport don't matter — no observer work is done
   * once the content has been revealed.
   */
  once?: boolean;
  /**
   * Margin around the viewport counted as visible, in CSS margin shorthand
   * (e.g. `"160px 440px"`). Use it to start loading content shortly before it
   * scrolls into view. Only expands the viewport itself — content inside a
   * nested scroll container is still clipped by it; see `scrollMargin`.
   */
  rootMargin?: string;
  /**
   * Margin applied to the clip rects of scrollable ancestors, in CSS margin
   * shorthand, so content inside a nested scroll container (e.g. a
   * horizontally scrolling strip) can count as visible shortly before it is
   * scrolled into view. Progressive enhancement: browsers without
   * IntersectionObserver scrollMargin support ignore it and content mounts
   * exactly on entry.
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
 * the user can actually see it.
 *
 * Visibility is observed against the viewport; IntersectionObserver clips the
 * intersection by every scrolling ancestor, so the same hook works inside a
 * horizontally scrolling strip and a vertically scrolling page alike.
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

  // A ref callback rather than an effect: it runs during commit, before
  // paint, so elements already in view are detected synchronously and start
  // loading a frame earlier than the observer's first (post-paint) entries.
  // The rect check ignores clipping by scrolling ancestors — at worst it
  // eagerly marks visible an element a scroll container still clips. A
  // zero-size rect means the element has no layout (e.g. a display: none
  // ancestor), so it cannot be visible no matter where it sits.
  const ref: RefCallback<T> = (element) => {
    if (element == null) {
      return () => {};
    }
    const rect = element.getBoundingClientRect();
    const isInitiallyInView =
      (rect.width > 0 || rect.height > 0) &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth;
    if (isInitiallyInView) {
      setIsVisible(true);
      if (once) {
        return () => {};
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
      // A transition so content that suspends when visibility thaws its
      // deferred inputs (e.g. a chart catching up on a frozen time range)
      // keeps showing what is already rendered instead of a fallback.
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

/**
 * Whether the nearest deferred container (e.g. a deferred chart panel) is
 * currently scrolled into view; `true` when there is none. Containers that
 * defer content with {@link useDeferredVisibility} provide it so descendants
 * can pause work while out of view.
 */
export const DeferredVisibilityContext = createContext<boolean>(true);

/**
 * The latest `value` seen while the nearest deferred container was in view;
 * while it is out of view the last-seen value is returned unchanged. Use it
 * to freeze query inputs (fetch keys, live time ranges) so background
 * refreshes don't refetch content the user can't see — content scrolled back
 * into view picks up the current value and catches up. Passes `value`
 * through when there is no deferred container ancestor.
 */
export function useVisibleValue<T>(value: T): T {
  const isVisible = useContext(DeferredVisibilityContext);
  const [visibleValue, setVisibleValue] = useState(value);
  if (isVisible && visibleValue !== value) {
    setVisibleValue(value);
  }
  return visibleValue;
}
