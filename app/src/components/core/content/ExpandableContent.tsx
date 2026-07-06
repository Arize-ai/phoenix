import { css } from "@emotion/react";
import type { CSSProperties, PropsWithChildren, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon, Icons } from "@phoenix/components/core/icon";

// Ignore subpixel line-height rounding so a 1px scroll/client-height mismatch
// does not show an expand button for content that visually fits.
const OVERFLOW_TOLERANCE_PX = 1;

const containerCSS = css`
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const contentCSS = css`
  height: 100%;
  overflow: hidden;

  // When collapsed, prevent all nested elements from scrolling
  &:not([data-expanded="true"]) {
    // need to exclude CodeMirror selection layer so text selection UI remains visible
    *:not(.cm-selectionLayer) {
      overflow: hidden !important;
    }
  }

  &[data-expanded="true"] {
    overflow: auto;
  }
`;

const expandButtonCSS = css`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--global-dimension-size-50);
  padding-bottom: var(--global-dimension-size-100);
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(
        --expandable-content-overlay-background-color,
        var(--global-background-color-default)
      )
      80%,
    var(
        --expandable-content-overlay-background-color,
        var(--global-background-color-default)
      )
      100%
  );
  cursor: pointer;
  border: none;
  font-size: var(--global-font-size-s);
  color: var(--global-text-color-500);
  transition: color 0.2s ease-in-out;

  .icon-wrap {
    font-size: var(--global-font-size-m);
    color: inherit;
  }

  &:hover {
    color: var(--global-color-primary);
  }
`;

const collapseButtonCSS = css`
  position: static;
  height: auto;
  padding-top: var(--global-dimension-size-100);
  background: var(
    --expandable-content-overlay-background-color,
    var(--global-background-color-default)
  );
`;

export interface ExpandableContentProps extends PropsWithChildren {
  height: number;
  /**
   * How expanded content behaves.
   * - "scroll": use a fixed-height container and scroll within it when expanded
   * - "grow": use a collapsed max height, then grow to full content height
   */
  expandedBehavior?: "scroll" | "grow";
  /**
   * Background color used by the gradient overlay.
   */
  overlayBackgroundColor?: string;
  /**
   * Controlled expanded state. If provided, the component will use this value
   * instead of managing its own internal state.
   */
  isExpanded?: boolean;
  /**
   * Callback fired when the expanded state changes.
   * Use this with `isExpanded` for controlled mode.
   */
  onExpandedChange?: (isExpanded: boolean) => void;
}

export function ExpandableContent({
  children,
  height,
  expandedBehavior = "scroll",
  overlayBackgroundColor = "var(--global-background-color-default)",
  isExpanded: controlledExpanded,
  onExpandedChange,
}: ExpandableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isOverflowing = useIsOverflowing({
    contentRef,
    containerRef,
    collapsedHeight: height,
    expandedBehavior,
  });
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Use controlled value if provided, otherwise use internal state
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const setExpanded = (nextIsExpanded: boolean) => {
    if (!isControlled) {
      setInternalExpanded(nextIsExpanded);
    }
    onExpandedChange?.(nextIsExpanded);
  };
  const shouldUseNaturalHeight = expandedBehavior === "grow" && isExpanded;
  const canCollapse =
    expandedBehavior === "grow" && isExpanded && isOverflowing;
  const containerStyle = {
    "--expandable-content-overlay-background-color": overlayBackgroundColor,
    ...(expandedBehavior === "scroll"
      ? { height }
      : shouldUseNaturalHeight
        ? {}
        : { maxHeight: height }),
  } as CSSProperties & {
    "--expandable-content-overlay-background-color": string;
  };

  return (
    <div
      ref={containerRef}
      css={containerCSS}
      style={containerStyle}
      className="expandable-content"
    >
      <div ref={contentRef} css={contentCSS} data-expanded={isExpanded}>
        {children}
      </div>
      {isOverflowing && !isExpanded && (
        <button
          className="expand-button button--reset"
          css={expandButtonCSS}
          onClick={() => setExpanded(true)}
          aria-label="Show more"
          aria-expanded={false}
        >
          <span>Expand</span>
          <Icon svg={<Icons.ChevronDownSmall />} />
        </button>
      )}
      {canCollapse && (
        <button
          className="expand-button button--reset"
          css={[expandButtonCSS, collapseButtonCSS]}
          onClick={() => setExpanded(false)}
          aria-label="Show less"
          aria-expanded={true}
        >
          <span>Collapse</span>
          <Icon svg={<Icons.ChevronUpSmall />} />
        </button>
      )}
    </div>
  );
}

/**
 * Hook to detect if content overflows its container.
 * Uses both ResizeObserver and MutationObserver to handle:
 * - Asynchronously-rendered content (e.g., CodeMirror, images)
 * - Streaming content where text is appended incrementally
 */
function useIsOverflowing({
  contentRef,
  containerRef,
  collapsedHeight,
  expandedBehavior,
}: {
  contentRef: RefObject<HTMLElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  collapsedHeight: number;
  expandedBehavior: ExpandableContentProps["expandedBehavior"];
}): boolean {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    const checkOverflow = () => {
      const overflowBoundary =
        expandedBehavior === "grow" ? collapsedHeight : container.clientHeight;
      setIsOverflowing(
        content.scrollHeight > overflowBoundary + OVERFLOW_TOLERANCE_PX
      );
    };

    checkOverflow();

    // ResizeObserver: handles element size changes (images loading, CodeMirror init)
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(content);

    // MutationObserver: handles streaming content where DOM nodes/text are appended
    // This is needed because ResizeObserver only fires on element box size changes,
    // not when scrollHeight changes due to content being added within a fixed-height container
    const mutationObserver = new MutationObserver(checkOverflow);
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [collapsedHeight, contentRef, containerRef, expandedBehavior]);

  return isOverflowing;
}
