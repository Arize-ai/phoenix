import { useLayoutEffect, useRef } from "react";

const NEAR_CONTENT_END_PX = 40;
const TURN_TOP_INSET_PX = 16;
const FOLLOW_UP_TOP_INSET_RATIO = 0.3;
const TURN_BOTTOM_INSET_PX = 32;
const FOLLOW_VIEWPORT_RATIO = 0.72;
const FOLLOW_TIME_CONSTANT_MS = 90;
const SETTLED_DISTANCE_PX = 0.5;
const USER_SCROLL_KEYS: ReadonlySet<string> = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

type ScrollMode =
  | "bottom"
  | "free"
  | "turn-pending"
  | "turn-anchor"
  | "turn"
  | "follow";

type CapturedAnchor = {
  element: HTMLElement;
  offsetFromScrollerTop: number;
};

/**
 * Owns every programmatic write to the chat transcript's scroll position.
 *
 * A locally submitted turn first places its user message near the top of the
 * viewport. A trailing spacer makes that placement possible even before the
 * assistant has produced enough content to overflow. The response then grows
 * into the open viewport without movement. Once the real response reaches the
 * viewport bottom, the spacer is removed and one requestAnimationFrame loop
 * eases toward a moving target.
 *
 * User intent always wins: wheel, touch, pointer, or keyboard navigation
 * cancels the animation and releases the transcript. Disclosure anchoring and
 * scroll-to-element requests also pass through this hook so no second scroll
 * primitive can race the streaming controller.
 */
export function useChatScroll({
  isRequestActive,
}: {
  isRequestActive: boolean;
}) {
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const contentElementRef = useRef<HTMLElement | null>(null);
  const contentEndElementRef = useRef<HTMLElement | null>(null);
  const spacerElementRef = useRef<HTMLElement | null>(null);
  const hasTurnSpacerRef = useRef(isRequestActive);
  const modeRef = useRef<ScrollMode>(
    isRequestActive ? "turn-pending" : "bottom"
  );
  const isRequestActiveRef = useRef(isRequestActive);
  const previousUserElementRef = useRef<HTMLElement | null>(null);
  const capturedAnchorRef = useRef<CapturedAnchor | null>(null);
  const lastScrollTopRef = useRef<number | null>(null);
  const selfScrollTopRef = useRef<number | null>(null);
  const targetScrollTopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAnimationTimeRef = useRef<number | null>(null);
  const shouldReleaseAfterAnimationRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  function prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function pauseAnimation(): void {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = null;
    lastAnimationTimeRef.current = null;
  }

  function cancelAnimation(): void {
    pauseAnimation();
    targetScrollTopRef.current = null;
    shouldReleaseAfterAnimationRef.current = false;
  }

  function writeScrollTop(nextScrollTop: number): void {
    const element = scrollElementRef.current;
    if (!element) {
      return;
    }
    const maximumScrollTop = Math.max(
      0,
      element.scrollHeight - element.clientHeight
    );
    element.scrollTop = Math.min(maximumScrollTop, Math.max(0, nextScrollTop));
    selfScrollTopRef.current = element.scrollTop;
    lastScrollTopRef.current = element.scrollTop;
  }

  function finishAnimation(): void {
    if (modeRef.current === "turn-anchor") {
      const shouldRelease = shouldReleaseAfterAnimationRef.current;
      shouldReleaseAfterAnimationRef.current = false;
      modeRef.current = shouldRelease ? "free" : "turn";
      if (!shouldRelease) {
        updateFollowTarget();
      }
      return;
    }
    if (!shouldReleaseAfterAnimationRef.current) {
      return;
    }
    shouldReleaseAfterAnimationRef.current = false;
    modeRef.current = "free";
  }

  function animateTowardTarget(animationTime: number): void {
    const element = scrollElementRef.current;
    const targetScrollTop = targetScrollTopRef.current;
    const isAnimating =
      modeRef.current === "turn-anchor" || modeRef.current === "follow";
    if (!element || targetScrollTop === null || !isAnimating) {
      cancelAnimation();
      return;
    }

    const distance = targetScrollTop - element.scrollTop;
    if (Math.abs(distance) <= SETTLED_DISTANCE_PX) {
      writeScrollTop(targetScrollTop);
      animationFrameRef.current = null;
      lastAnimationTimeRef.current = null;
      targetScrollTopRef.current = null;
      finishAnimation();
      return;
    }

    const previousTime = lastAnimationTimeRef.current ?? animationTime - 16;
    const elapsed = Math.min(64, Math.max(1, animationTime - previousTime));
    const progress = 1 - Math.exp(-elapsed / FOLLOW_TIME_CONSTANT_MS);
    const previousScrollTop = element.scrollTop;
    writeScrollTop(element.scrollTop + distance * progress);
    if (element.scrollTop === previousScrollTop) {
      // Browsers quantize scroll offsets to device-dependent increments. Near
      // the target, an eased subpixel step can round back to the same value
      // forever, leaving the state machine stuck in its animation phase. Snap
      // the visually imperceptible remainder and let the next phase begin.
      writeScrollTop(targetScrollTop);
      animationFrameRef.current = null;
      lastAnimationTimeRef.current = null;
      targetScrollTopRef.current = null;
      finishAnimation();
      return;
    }
    lastAnimationTimeRef.current = animationTime;
    animationFrameRef.current = requestAnimationFrame(animateTowardTarget);
  }

  function startScrollAnimation(): void {
    const targetScrollTop = targetScrollTopRef.current;
    if (targetScrollTop === null) {
      return;
    }
    if (prefersReducedMotion()) {
      writeScrollTop(targetScrollTop);
      targetScrollTopRef.current = null;
      finishAnimation();
      return;
    }
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animateTowardTarget);
    }
  }

  function updateFollowTarget(): void {
    const scrollElement = scrollElementRef.current;
    const contentEndElement = contentEndElementRef.current;
    if (!scrollElement || !contentEndElement) {
      return;
    }
    const scrollRect = scrollElement.getBoundingClientRect();
    const contentEndRect = contentEndElement.getBoundingClientRect();
    if (hasTurnSpacerRef.current) {
      if (contentEndRect.top < scrollRect.bottom) {
        return;
      }
      // The real turn content now fills the viewport, so removing the temporary
      // runway cannot clamp the current scroll position or move the anchored
      // user message. Latch it off for the rest of this turn.
      hasTurnSpacerRef.current = false;
      contentEndElement.style.height = "0px";
    }
    const followLine =
      scrollRect.top + scrollElement.clientHeight * FOLLOW_VIEWPORT_RATIO;
    const overflow = contentEndRect.top - followLine;
    if (overflow <= 0) {
      if (shouldReleaseAfterAnimationRef.current) {
        modeRef.current = "free";
        shouldReleaseAfterAnimationRef.current = false;
      }
      return;
    }

    modeRef.current = "follow";
    targetScrollTopRef.current = scrollElement.scrollTop + overflow;
    startScrollAnimation();
  }

  function getTurnTopInset(): number {
    const scrollElement = scrollElementRef.current;
    const userElements = contentElementRef.current?.querySelectorAll(
      '[data-chat-message-role="user"]'
    );
    const isFollowUp = (userElements?.length ?? 0) > 1;
    if (!scrollElement || !isFollowUp) {
      return TURN_TOP_INSET_PX;
    }
    return scrollElement.clientHeight * FOLLOW_UP_TOP_INSET_RATIO;
  }

  function resizeTurnSpacer(): void {
    const scrollElement = scrollElementRef.current;
    const spacerElement = spacerElementRef.current;
    if (!scrollElement || !spacerElement) {
      return;
    }
    if (!hasTurnSpacerRef.current) {
      spacerElement.style.height = "0px";
      return;
    }
    const turnTopInset = getTurnTopInset();
    const spacerHeight = Math.max(
      0,
      scrollElement.clientHeight - turnTopInset - TURN_BOTTOM_INSET_PX
    );
    spacerElement.style.height = `${spacerHeight}px`;
  }

  function getLatestUserElement(): HTMLElement | null {
    const elements = contentElementRef.current?.querySelectorAll<HTMLElement>(
      '[data-chat-message-role="user"]'
    );
    return elements?.item(elements.length - 1) ?? null;
  }

  function tryAnchorPendingTurn(): void {
    if (modeRef.current !== "turn-pending") {
      return;
    }
    const scrollElement = scrollElementRef.current;
    const spacerElement = spacerElementRef.current;
    const userElement = getLatestUserElement();
    if (
      !scrollElement ||
      !spacerElement ||
      !userElement ||
      userElement === previousUserElementRef.current
    ) {
      return;
    }
    const scrollRect = scrollElement.getBoundingClientRect();
    const userRect = userElement.getBoundingClientRect();
    const turnTopInset = getTurnTopInset();
    targetScrollTopRef.current =
      scrollElement.scrollTop + userRect.top - scrollRect.top - turnTopInset;
    previousUserElementRef.current = userElement;
    modeRef.current = "turn-anchor";
    startScrollAnimation();
  }

  function pinInitialTranscriptToBottom(): void {
    const element = scrollElementRef.current;
    if (element) {
      writeScrollTop(element.scrollHeight - element.clientHeight);
    }
  }

  function handleResize(): void {
    resizeTurnSpacer();
    switch (modeRef.current) {
      case "bottom":
        pinInitialTranscriptToBottom();
        break;
      case "turn-pending":
        tryAnchorPendingTurn();
        break;
      case "turn-anchor":
        break;
      case "turn":
      case "follow":
        updateFollowTarget();
        break;
      case "free":
        break;
    }
  }

  function getResizeObserver(): ResizeObserver {
    resizeObserverRef.current ??= new ResizeObserver(handleResize);
    return resizeObserverRef.current;
  }

  function releaseToUser(): void {
    cancelAnimation();
    modeRef.current = "free";
  }

  function handleUserInteraction(): void {
    releaseToUser();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (USER_SCROLL_KEYS.has(event.key)) {
      releaseToUser();
    }
  }

  function handleScroll(): void {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }
    const scrollTop = scrollElement.scrollTop;
    const previousScrollTop = lastScrollTopRef.current ?? scrollTop;
    lastScrollTopRef.current = scrollTop;
    const isSelfScroll =
      selfScrollTopRef.current !== null &&
      Math.abs(scrollTop - selfScrollTopRef.current) <= 1;
    if (isSelfScroll) {
      selfScrollTopRef.current = null;
      return;
    }
    selfScrollTopRef.current = null;

    // Do not infer user intent from scroll direction. Streamdown highlighting,
    // content visibility, and browser scroll-range clamping can all move
    // scrollTop without input; the explicit input listeners above own release.
    const contentEndElement = contentEndElementRef.current;
    if (!contentEndElement || scrollTop <= previousScrollTop) {
      return;
    }
    const scrollRect = scrollElement.getBoundingClientRect();
    const contentEndRect = contentEndElement.getBoundingClientRect();
    const isContentEndVisible =
      contentEndRect.top <= scrollRect.bottom + NEAR_CONTENT_END_PX;
    if (
      isContentEndVisible &&
      isRequestActiveRef.current &&
      modeRef.current === "free"
    ) {
      modeRef.current = "follow";
    }
  }

  function scrollRef(element: HTMLElement | null): void {
    const previousElement = scrollElementRef.current;
    if (previousElement) {
      previousElement.removeEventListener("scroll", handleScroll);
      previousElement.removeEventListener("wheel", handleUserInteraction);
      previousElement.removeEventListener("pointerdown", handleUserInteraction);
      previousElement.removeEventListener("touchstart", handleUserInteraction);
      previousElement.removeEventListener("keydown", handleKeyDown);
      resizeObserverRef.current?.unobserve(previousElement);
    }
    scrollElementRef.current = element;
    lastScrollTopRef.current = element?.scrollTop ?? null;
    if (!element) {
      // React clears a callback ref before reattaching it when the callback's
      // identity changes during a streamed render. Keep the RAF and its timing
      // intact across that synchronous gap; otherwise every token update
      // restarts the easing clock and the turn can remain stuck in its anchor
      // phase. A real unmount stays detached, so the next frame sees no scroll
      // element and cancels itself in `animateTowardTarget`.
      return;
    }
    element.addEventListener("scroll", handleScroll, { passive: true });
    element.addEventListener("wheel", handleUserInteraction, { passive: true });
    element.addEventListener("pointerdown", handleUserInteraction, {
      passive: true,
    });
    element.addEventListener("touchstart", handleUserInteraction, {
      passive: true,
    });
    element.addEventListener("keydown", handleKeyDown);
    getResizeObserver().observe(element);
    resizeTurnSpacer();
    switch (modeRef.current) {
      case "bottom":
        pinInitialTranscriptToBottom();
        break;
      case "turn-pending":
        tryAnchorPendingTurn();
        break;
      case "turn-anchor":
        startScrollAnimation();
        break;
      case "follow":
        updateFollowTarget();
        break;
      case "turn":
      case "free":
        break;
    }
  }

  function contentRef(element: HTMLElement | null): void {
    const previousElement = contentElementRef.current;
    if (previousElement) {
      resizeObserverRef.current?.unobserve(previousElement);
    }
    contentElementRef.current = element;
    if (element) {
      getResizeObserver().observe(element);
      tryAnchorPendingTurn();
    }
  }

  function turnSpacerRef(element: HTMLElement | null): void {
    contentEndElementRef.current = element;
    spacerElementRef.current = element;
    resizeTurnSpacer();
    tryAnchorPendingTurn();
  }

  function startTurn(): void {
    cancelAnimation();
    previousUserElementRef.current = getLatestUserElement();
    hasTurnSpacerRef.current = true;
    modeRef.current = "turn-pending";
    resizeTurnSpacer();
  }

  function resumeFollowing(): void {
    cancelAnimation();
    modeRef.current = "follow";
    updateFollowTarget();
  }

  function stopScroll(): void {
    releaseToUser();
  }

  function captureAnchor(element: HTMLElement | null): void {
    releaseToUser();
    capturedAnchorRef.current = null;
    const scrollElement = scrollElementRef.current;
    if (!scrollElement || !element) {
      return;
    }
    capturedAnchorRef.current = {
      element,
      offsetFromScrollerTop:
        element.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top,
    };
  }

  function restoreAnchor(element: HTMLElement | null): void {
    const capturedAnchor = capturedAnchorRef.current;
    capturedAnchorRef.current = null;
    const scrollElement = scrollElementRef.current;
    if (
      !capturedAnchor ||
      !scrollElement ||
      capturedAnchor.element !== element
    ) {
      return;
    }
    const nextOffsetFromScrollerTop =
      capturedAnchor.element.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top;
    writeScrollTop(
      scrollElement.scrollTop +
        nextOffsetFromScrollerTop -
        capturedAnchor.offsetFromScrollerTop
    );
  }

  function scrollElementToTop(element: HTMLElement | null): void {
    releaseToUser();
    const scrollElement = scrollElementRef.current;
    if (!scrollElement || !element) {
      return;
    }
    writeScrollTop(
      scrollElement.scrollTop +
        element.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top -
        TURN_TOP_INSET_PX
    );
  }

  useLayoutEffect(() => {
    const wasRequestActive = isRequestActiveRef.current;
    isRequestActiveRef.current = isRequestActive;
    if (!wasRequestActive || isRequestActive) {
      return;
    }

    if (modeRef.current === "follow") {
      shouldReleaseAfterAnimationRef.current = true;
      updateFollowTarget();
      if (animationFrameRef.current === null) {
        finishAnimation();
      }
    } else if (
      modeRef.current === "turn-anchor" ||
      modeRef.current === "turn" ||
      modeRef.current === "turn-pending"
    ) {
      if (modeRef.current === "turn-anchor") {
        shouldReleaseAfterAnimationRef.current = true;
      } else {
        modeRef.current = "free";
      }
    }
  }, [isRequestActive]);

  return {
    captureAnchor,
    contentRef,
    restoreAnchor,
    resumeFollowing,
    scrollElementToTop,
    scrollRef,
    startTurn,
    stopScroll,
    turnSpacerRef,
  };
}
