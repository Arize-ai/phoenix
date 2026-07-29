import type { RefCallback } from "react";
import { startTransition, useState } from "react";

export type UseDeferredVisibilityParams = {
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
    if (
      (rect.width > 0 || rect.height > 0) &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth
    ) {
      setIsVisible(true);
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
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
  };

  return { ref, isVisible, hasBeenVisible };
}
