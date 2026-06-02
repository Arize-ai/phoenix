import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";
import { useCallback, useRef } from "react";

import { CopyToClipboardButton } from "@phoenix/components";
import { ExpandableContent } from "@phoenix/components/core/content/ExpandableContent";

import { useChatScrollContext } from "./ChatScrollContext";

export const TOOL_PART_ENTRY_KEYFRAMES = keyframes`
  from {
    opacity: 0;
    transform: translateY(-2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const TOOL_CALL_SUMMARY_LANE_RULES = {
  titleFlex: "0 1 auto",
  titleMinWidth: "0",
  titleMaxWidth: "55%",
  middleFlex: "1 1 50px",
  middleMinWidth: "50px",
  statusFlex: "0 1 auto",
  statusMinWidth: "0",
  statusMaxWidth: "none",
} as const;

/**
 * A label row for a tool part section (e.g., "Command", "Output", "Error").
 */
export function ToolPartLabel({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "danger" | "warning" | "success";
}) {
  return (
    <div className="tool-part__line">
      <span className="tool-part__label" data-variant={variant}>
        {children}
      </span>
    </div>
  );
}

/**
 * A preformatted code block for tool part content with optional copy button.
 */
export function ToolPartCodeBlock({
  children,
  allowCopy = true,
}: {
  children: string;
  allowCopy?: boolean;
}) {
  return (
    <div
      className={`tool-part__line${allowCopy ? " tool-part__line--copyable" : ""}`}
    >
      <code className="tool-part__code">{children || "(empty)"}</code>
      {allowCopy ? (
        <CopyToClipboardButton
          text={children}
          size="S"
          variant="quiet"
          tooltipText="Copy"
        />
      ) : null}
    </div>
  );
}

/**
 * Status indicator for the tool part summary bar (e.g., "Running", "Error").
 */
export function ToolPartStatus({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "danger" | "warning" | "success";
}) {
  return (
    <span className="tool-part__status" data-variant={variant}>
      {children}
    </span>
  );
}

/**
 * A row of metadata key-value pairs (e.g., exit code, duration).
 */
export function ToolPartMeta({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="tool-part__meta">
      {items.map(({ label, value }) => (
        <span key={label} className="tool-part__meta-group">
          <span className="tool-part__meta-label">{label}</span>
          <code className="tool-part__meta-value">{value}</code>
        </span>
      ))}
    </div>
  );
}

const COLLAPSED_HEIGHT_PX = 320;

const expandableSectionCSS = css`
  --expandable-content-overlay-background-color: var(
    --tool-call-body-background-color
  );
`;

/**
 * Finds the nearest scrollable parent element.
 */
function getScrollableParent(element: HTMLElement): HTMLElement | null {
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
 * Wrapper for tool part input/output sections. Automatically collapses content
 * that exceeds the collapsed height, showing an expand/collapse button.
 */
export function ToolPartExpandableSection({
  children,
}: {
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<{
    scrollParent: HTMLElement;
    offsetFromParentTop: number;
  } | null>(null);
  const chatScrollContext = useChatScrollContext();

  const handleBeforeExpandedChange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollParent = getScrollableParent(container);
    if (!scrollParent) return;

    const containerRect = container.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const offsetFromParentTop = containerRect.top - parentRect.top;

    // Stop the stick-to-bottom library from fighting our scroll restore
    chatScrollContext?.stopScroll();

    scrollAnchorRef.current = { scrollParent, offsetFromParentTop };
  }, [chatScrollContext]);

  const handleAfterExpandedChange = useCallback(() => {
    const anchor = scrollAnchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;

    const { scrollParent, offsetFromParentTop } = anchor;
    const newContainerRect = container.getBoundingClientRect();
    const newParentRect = scrollParent.getBoundingClientRect();
    const newOffsetFromParentTop = newContainerRect.top - newParentRect.top;
    const delta = newOffsetFromParentTop - offsetFromParentTop;

    scrollParent.scrollTop += delta;
    scrollAnchorRef.current = null;
  }, []);

  return (
    <div ref={containerRef} css={expandableSectionCSS}>
      <ExpandableContent
        height={COLLAPSED_HEIGHT_PX}
        expandedBehavior="grow"
        onBeforeExpandedChange={handleBeforeExpandedChange}
        onAfterExpandedChange={handleAfterExpandedChange}
      >
        {children}
      </ExpandableContent>
    </div>
  );
}
