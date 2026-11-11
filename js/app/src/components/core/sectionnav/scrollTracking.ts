/**
 * Why the nav has stopped following the scroll position for now:
 * - `programmaticallyScrolling`: the nav itself is scrolling the pane to a
 *   section, after a link click or on mount to `defaultActiveId`. That
 *   section's link stays current while other sections pass by.
 * - `holdingDefaultSection`: the nav is keeping `defaultActiveId` current
 *   until the user scrolls, including after its own scroll there has settled.
 */
export type ScrollTrackingPauseReason =
  | "programmaticallyScrolling"
  | "holdingDefaultSection";

/**
 * Pause state for a section nav. The nav's event handlers call the `record*`
 * methods to report what happened; none of the methods are callbacks.
 */
export type ScrollTracking = {
  readonly isPaused: boolean;
  pause: (reason: ScrollTrackingPauseReason) => void;
  /** Call when the scroll container scrolls, whatever moved it */
  recordScroll: () => void;
  /**
   * Call when the user acts to scroll: a wheel turn, a touch drag, a scroll
   * key, or a press on the scrollbar
   */
  recordUserScrollInput: () => void;
  /**
   * Call once scrolling has settled. Ends a programmatic scroll's pause, or a
   * held default once the user has scrolled. Returns whether the nav should
   * now pick the current section from the scroll position.
   */
  settle: () => boolean;
};

/**
 * Decides when a section nav follows the scroll position and when it holds
 * the current section it was given. A pause ends when scrolling settles. The
 * nav then picks the current section from the scroll position only if the
 * user scrolled during the pause. So the nav's own scroll never swaps the
 * link it scrolled to for another section (as the scrolled-to-end rule would
 * for a section near the end), but a user who scrolls elsewhere mid-pause is
 * followed.
 */
export function createScrollTracking(): ScrollTracking {
  let pauseReason: ScrollTrackingPauseReason | null = null;
  let hasUserScrolled = false;
  return {
    get isPaused() {
      return pauseReason != null;
    },
    pause(reason) {
      pauseReason = reason;
      hasUserScrolled = false;
    },
    recordScroll() {
      // While a default is held, only the user scrolls the pane; during a
      // programmatic scroll, the scroll is the nav's own
      if (pauseReason === "holdingDefaultSection") {
        hasUserScrolled = true;
      }
    },
    recordUserScrollInput() {
      if (pauseReason != null) {
        hasUserScrolled = true;
      }
    },
    settle() {
      if (pauseReason == null) {
        return true;
      }
      if (pauseReason === "holdingDefaultSection" && !hasUserScrolled) {
        return false;
      }
      const shouldResolve = hasUserScrolled;
      pauseReason = null;
      hasUserScrolled = false;
      return shouldResolve;
    },
  };
}
