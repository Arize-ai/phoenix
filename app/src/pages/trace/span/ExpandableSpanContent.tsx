import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@phoenix/components/core/button";
import {
  ExpandableContent,
  type ExpansionCutoffSize,
} from "@phoenix/components/core/content";

const jumpToEndActionCSS = css`
  position: sticky;
  z-index: var(--global-z-index-local-raised);
  bottom: calc(
    var(--global-span-details-section-heading-height) +
      var(--global-dimension-size-100)
  );
  display: flex;
  justify-content: center;
  width: 100%;
  height: 0;
  pointer-events: none;

  .react-aria-Button {
    pointer-events: auto;
    transform: translateY(-100%);
  }
`;

const contentBodyCSS = css`
  display: flow-root;
  min-width: 0;
`;

const jumpToEndTargetCSS = css`
  display: block;
  height: var(--global-border-size-thin);
`;

const JUMP_TO_END_HEIGHT_THRESHOLD_PROPERTY = "--global-dimension-size-6000";
const CONTENT_SCROLL_VISIBLE_GAP_PROPERTY = "--global-dimension-size-200";
const JUMP_ALIGNMENT_DURATION_MILLISECONDS = 1500;
const SCROLL_ALIGNMENT_TOLERANCE_PIXELS = 1;

/**
 * Bounds potentially large content inside a span card and adds an inline
 * expand affordance only when the rendered content overflows the global XL
 * expansion cutoff. Expanded content taller than the global size-6000 token
 * also gets a persistent action that jumps its end into view.
 *
 * This is the span-details interaction boundary: arbitrary span content goes
 * here for consistent expand, collapse, and jump behavior. Content-specific
 * adapters may supply a bounded collapsed preview, but should leave expansion
 * state and navigation to this component. The span details expand-all control
 * owns disclosure cards, not overflow affordances inside those cards.
 */
export function ExpandableSpanContent({
  children,
  collapsedPreview,
  height = "xl",
  overlayBackgroundColor,
}: PropsWithChildren<{
  /**
   * A bounded preview to render while collapsed instead of mounting the full
   * content. Providing one also guarantees the expand affordance is shown.
   */
  collapsedPreview?: ReactNode;
  height?: ExpansionCutoffSize;
  overlayBackgroundColor?: string;
}>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const jumpToEndTargetRef = useRef<HTMLSpanElement>(null);
  const shouldSnapAfterCollapseRef = useRef(false);
  const stopJumpAlignmentRef = useRef<(() => void) | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isAboveJumpToEndThreshold = useIsAboveJumpToEndThreshold(contentRef);
  const hasCollapsedPreview = collapsedPreview != null;
  const jumpControl = useJumpToEndControl({
    contentRef,
    isEnabled: isExpanded && isAboveJumpToEndThreshold,
    targetRef: jumpToEndTargetRef,
  });
  const jumpScrollContainer = jumpControl.scrollContainer;

  useLayoutEffect(() => {
    if (isExpanded || !shouldSnapAfterCollapseRef.current) {
      return;
    }
    shouldSnapAfterCollapseRef.current = false;
    const content = contentRef.current;
    if (content) {
      snapCollapsedContentIntoView({ content });
    }
  }, [isExpanded]);

  useEffect(
    () => () => {
      stopJumpAlignmentRef.current?.();
    },
    []
  );

  const handleExpandedChange = (nextIsExpanded: boolean) => {
    if (!nextIsExpanded) {
      stopJumpAlignmentRef.current?.();
      stopJumpAlignmentRef.current = null;
    }
    shouldSnapAfterCollapseRef.current = isExpanded && !nextIsExpanded;
    setIsExpanded(nextIsExpanded);
  };

  return (
    <>
      <ExpandableContent
        height={height}
        expandedBehavior="grow"
        overlayBackgroundColor={overlayBackgroundColor}
        isExpanded={isExpanded}
        isOverflowing={hasCollapsedPreview ? true : undefined}
        onExpandedChange={handleExpandedChange}
      >
        <div
          className="expandable-span-content__body"
          ref={contentRef}
          css={contentBodyCSS}
        >
          {isExpanded || !hasCollapsedPreview ? children : collapsedPreview}
        </div>
      </ExpandableContent>
      {isExpanded ? (
        <span
          ref={jumpToEndTargetRef}
          className="expandable-span-content__jump-to-end-target"
          css={jumpToEndTargetCSS}
          aria-hidden="true"
        />
      ) : null}
      {jumpScrollContainer && jumpControl.isVisible
        ? createPortal(
            <div
              className="expandable-span-content__jump-to-end-action"
              css={jumpToEndActionCSS}
            >
              <Button
                size="S"
                variant="primary"
                onPress={() => {
                  const target = jumpToEndTargetRef.current;
                  const contentRegion =
                    contentRef.current?.closest<HTMLElement>(
                      ".expandable-content"
                    );
                  if (target && contentRegion) {
                    stopJumpAlignmentRef.current?.();
                    stopJumpAlignmentRef.current = startJumpTargetAlignment({
                      contentRegion,
                      scrollContainer: jumpScrollContainer,
                      target,
                    });
                  }
                }}
              >
                Jump to end
              </Button>
            </div>,
            jumpScrollContainer
          )
        : null}
    </>
  );
}

type JumpControlState = {
  isVisible: boolean;
  scrollContainer: HTMLElement | null;
};

const INITIAL_JUMP_CONTROL_STATE: JumpControlState = {
  isVisible: false,
  scrollContainer: null,
};

function useJumpToEndControl({
  contentRef,
  isEnabled,
  targetRef,
}: {
  contentRef: RefObject<HTMLElement | null>;
  isEnabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
}): JumpControlState {
  const [state, setState] = useState<JumpControlState>(
    INITIAL_JUMP_CONTROL_STATE
  );

  useEffect(() => {
    const content = contentRef.current;
    const target = targetRef.current;
    if (!isEnabled || !content || !target) {
      return undefined;
    }
    const scrollContainer = getSpanDetailsScrollContainer(content);
    const contentRegion = content.closest<HTMLElement>(".expandable-content");
    if (!scrollContainer || !contentRegion) {
      return undefined;
    }
    const notesBar = scrollContainer.querySelector<HTMLElement>(
      "[data-span-details-notes-bar]"
    );

    const updateVisibility = () => {
      const contentRegionRect = contentRegion.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const visibleBottom = getContentVisibleBottom({
        notesBar,
        scrollContainer,
      });
      const isVisible =
        contentRegionRect.top < visibleBottom &&
        targetRect.bottom > visibleBottom + SCROLL_ALIGNMENT_TOLERANCE_PIXELS;
      setState((currentState) =>
        currentState.scrollContainer === scrollContainer &&
        currentState.isVisible === isVisible
          ? currentState
          : { isVisible, scrollContainer }
      );
    };

    updateVisibility();
    scrollContainer.addEventListener("scroll", updateVisibility, {
      passive: true,
    });
    const resizeObserver = new ResizeObserver(updateVisibility);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(contentRegion);
    if (notesBar) {
      resizeObserver.observe(notesBar);
    }

    return () => {
      scrollContainer.removeEventListener("scroll", updateVisibility);
      resizeObserver.disconnect();
    };
  }, [contentRef, isEnabled, targetRef]);

  return isEnabled ? state : INITIAL_JUMP_CONTROL_STATE;
}

/**
 * Gets the lowest unobscured point where the content end should land.
 * @param params - Visible-boundary parameters.
 * @param params.notesBar - Sticky Notes bar that covers the scrollport bottom.
 * @param params.scrollContainer - Span details scrolling region.
 */
function getContentVisibleBottom({
  notesBar,
  scrollContainer,
}: {
  notesBar: HTMLElement | null;
  scrollContainer: HTMLElement;
}): number {
  const scrollContainerBottom = scrollContainer.getBoundingClientRect().bottom;
  const notesBarHeight = notesBar?.getBoundingClientRect().height ?? 0;
  const configuredGap = Number.parseFloat(
    getComputedStyle(scrollContainer).getPropertyValue(
      CONTENT_SCROLL_VISIBLE_GAP_PROPERTY
    )
  );
  const visibleGap = Number.isFinite(configuredGap) ? configuredGap : 0;
  return scrollContainerBottom - notesBarHeight - visibleGap;
}

/**
 * Scrolls the true end of an expanded region above fixed bottom content.
 * @param params - Scroll parameters.
 * @param params.scrollContainer - Span details scrolling region.
 * @param params.target - Marker after the expanded region and Collapse control.
 */
function scrollJumpTargetIntoView({
  scrollContainer,
  target,
}: {
  scrollContainer: HTMLElement;
  target: HTMLElement;
}) {
  const notesBar = scrollContainer.querySelector<HTMLElement>(
    "[data-span-details-notes-bar]"
  );
  const visibleBottom = getContentVisibleBottom({
    notesBar,
    scrollContainer,
  });
  const scrollDistance = Math.max(
    target.getBoundingClientRect().bottom - visibleBottom,
    0
  );
  scrollContainer.scrollTop += scrollDistance;
}

/**
 * Keeps a jump target aligned while deferred content settles after scrolling.
 * @param params - Alignment parameters.
 * @param params.contentRegion - Expanded content whose reflow can move the end.
 * @param params.scrollContainer - Span details scrolling region.
 * @param params.target - Marker after the expanded region and Collapse control.
 */
function startJumpTargetAlignment({
  contentRegion,
  scrollContainer,
  target,
}: {
  contentRegion: HTMLElement;
  scrollContainer: HTMLElement;
  target: HTMLElement;
}): () => void {
  const scrollContent = target.closest<HTMLElement>(
    "[data-span-details-sections-content]"
  );
  const notesBar = scrollContainer.querySelector<HTMLElement>(
    "[data-span-details-notes-bar]"
  );
  let timeoutId: number | null = null;
  let isStopped = false;

  const alignTarget = () => {
    if (!isStopped) {
      scrollJumpTargetIntoView({ scrollContainer, target });
    }
  };
  const stop = () => {
    if (isStopped) {
      return;
    }
    isStopped = true;
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
    resizeObserver.disconnect();
    scrollContainer.removeEventListener("wheel", stop);
    scrollContainer.removeEventListener("touchstart", stop);
    scrollContainer.removeEventListener("pointerdown", stop);
    scrollContainer.removeEventListener("keydown", stop);
  };
  const resizeObserver = new ResizeObserver(alignTarget);
  resizeObserver.observe(contentRegion);
  resizeObserver.observe(scrollContainer);
  if (scrollContent) {
    resizeObserver.observe(scrollContent);
  }
  if (notesBar) {
    resizeObserver.observe(notesBar);
  }
  scrollContainer.addEventListener("wheel", stop, { passive: true });
  scrollContainer.addEventListener("touchstart", stop, { passive: true });
  scrollContainer.addEventListener("pointerdown", stop, { passive: true });
  scrollContainer.addEventListener("keydown", stop);
  timeoutId = window.setTimeout(stop, JUMP_ALIGNMENT_DURATION_MILLISECONDS);
  alignTarget();

  return stop;
}

/**
 * Restores the collapsed affordance to the usable bottom of the scrollport.
 * @param params - Collapse-position parameters.
 * @param params.content - Content body inside the collapsed expandable region.
 */
function snapCollapsedContentIntoView({
  content,
}: {
  content: HTMLElement;
}): void {
  const contentRegion = content.closest<HTMLElement>(".expandable-content");
  const scrollContainer = getSpanDetailsScrollContainer(content);
  const expandButton = contentRegion?.querySelector<HTMLElement>(
    '[aria-label="Show more"]'
  );
  if (!scrollContainer || !expandButton) {
    return;
  }
  const notesBar = scrollContainer.querySelector<HTMLElement>(
    "[data-span-details-notes-bar]"
  );
  const visibleBottom = getContentVisibleBottom({
    notesBar,
    scrollContainer,
  });
  scrollContainer.scrollTop +=
    expandButton.getBoundingClientRect().bottom - visibleBottom;
}

function getSpanDetailsScrollContainer(
  element: HTMLElement
): HTMLElement | null {
  const scrollContent = element.closest<HTMLElement>(
    "[data-span-details-sections-content]"
  );
  return scrollContent?.parentElement ?? null;
}

function useIsAboveJumpToEndThreshold(
  contentRef: RefObject<HTMLElement | null>
): boolean {
  const [isAboveThreshold, setIsAboveThreshold] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const threshold = Number.parseFloat(
        getComputedStyle(content).getPropertyValue(
          JUMP_TO_END_HEIGHT_THRESHOLD_PROPERTY
        )
      );
      setIsAboveThreshold(
        Number.isFinite(threshold) && entry.contentRect.height > threshold
      );
    });
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [contentRef]);

  return isAboveThreshold;
}
