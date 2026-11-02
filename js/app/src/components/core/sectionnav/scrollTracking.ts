/**
 * Why tracking the scroll position is paused:
 * - `scrollToSection`: the nav is scrolling a section into view, for a link
 *   click or the mount scroll to `defaultActiveId`; that section's link stays
 *   current while other sections slide past the bar.
 * - `defaultActiveId`: the nav just mounted with a given current section,
 *   which stays current until the user scrolls: from mount when the nav could
 *   not scroll to it, or once its scroll to it settles.
 */
export type ScrollTrackingPauseReason = "scrollToSection" | "defaultActiveId";

export type ScrollTracking = {
  readonly isPaused: boolean;
  pause: (reason: ScrollTrackingPauseReason) => void;
  /** The scroll container scrolled, for whatever reason */
  noteScroll: () => void;
  /** The user acted to scroll (wheel, touch, scroll keys, scrollbar press) */
  noteUserScrollInput: () => void;
  /**
   * Scrolling has settled. Ends a section scroll's pause, or a held default
   * once the user has scrolled, and returns whether the current section should
   * be resolved from the scroll position.
   */
  settle: () => boolean;
};

/**
 * Decides when a section nav follows the scroll position and when it holds
 * the current section it was given. A pause ends when scrolling settles; the
 * scroll position is then resolved only if the user scrolled during the pause,
 * so the nav's own scroll never swaps the scrolled-to link for another section
 * (as the scrolled-to-end rule would when that section is near the
 * end), but a user who scrolls elsewhere mid-pause is followed.
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
    noteScroll() {
      // Nothing but the user scrolls the pane while a default is held; while
      // a section scroll is held, the scroll is the nav's own
      if (pauseReason === "defaultActiveId") {
        hasUserScrolled = true;
      }
    },
    noteUserScrollInput() {
      if (pauseReason != null) {
        hasUserScrolled = true;
      }
    },
    settle() {
      if (pauseReason == null) {
        return true;
      }
      if (pauseReason === "defaultActiveId" && !hasUserScrolled) {
        return false;
      }
      const shouldResolve = hasUserScrolled;
      pauseReason = null;
      hasUserScrolled = false;
      return shouldResolve;
    },
  };
}
