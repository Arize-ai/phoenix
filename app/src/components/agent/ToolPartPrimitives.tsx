import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import { Button, CopyToClipboardButton, Flex } from "@phoenix/components";
import { ExpandableContent } from "@phoenix/components/core/content/ExpandableContent";

import { useScrollAnchor } from "./scrollAnchor";

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
      className={`tool-part__line${
        allowCopy ? " tool-part__line--copyable" : ""
      }`}
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

/**
 * Canonical inset for the Accept/Reject footer shared by every approval-style
 * tool part (prompt edits, dataset writes, span annotations, experiment
 * patches, …). Centralizing it here keeps the footer padding identical across
 * all PXI tools instead of each detail component re-specifying its own.
 */
const approvalActionsRowCSS = css`
  padding: var(--global-dimension-size-50) var(--global-dimension-size-200)
    var(--global-dimension-size-150);
`;

/**
 * The right-aligned Accept/Reject buttons rendered at the bottom of a tool part
 * awaiting user approval. When the proposal can no longer be acted on (e.g. it
 * was made in an earlier session), pass `staleMessage` to explain why the
 * disabled buttons can't be used.
 */
export function ToolPartApprovalActions({
  onAccept,
  onReject,
  isDisabled = false,
  staleMessage,
}: {
  onAccept: () => void;
  onReject: () => void;
  isDisabled?: boolean;
  staleMessage?: string;
}) {
  return (
    <>
      <div css={approvalActionsRowCSS}>
        <Flex direction="row-reverse" gap="size-100">
          <Button
            size="S"
            variant="primary"
            isDisabled={isDisabled}
            onPress={onAccept}
          >
            Accept
          </Button>
          <Button size="S" isDisabled={isDisabled} onPress={onReject}>
            Reject
          </Button>
        </Flex>
      </div>
      {isDisabled && staleMessage ? (
        <ToolPartCodeBlock>{staleMessage}</ToolPartCodeBlock>
      ) : null}
    </>
  );
}

const COLLAPSED_HEIGHT_PX = 320;

const expandableSectionCSS = css`
  --expandable-content-overlay-background-color: var(
    --tool-call-body-background-color
  );
`;

/**
 * Wrapper for tool part input/output sections. Automatically collapses content
 * that exceeds the collapsed height, showing an expand/collapse button.
 *
 * Drives `ExpandableContent` in controlled mode so we can bracket each toggle
 * with scroll anchoring — recording the section's position before it grows or
 * shrinks and restoring it afterward — without `ExpandableContent` needing to
 * know anything about the surrounding scroll container.
 */
export function ToolPartExpandableSection({
  children,
}: {
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAnchor = useScrollAnchor();

  const handleExpandedChange = useCallback(
    (nextIsExpanded: boolean) => {
      scrollAnchor.capture(containerRef.current);
      setIsExpanded(nextIsExpanded);
      requestAnimationFrame(() => scrollAnchor.restore(containerRef.current));
    },
    [scrollAnchor]
  );

  return (
    <div ref={containerRef} css={expandableSectionCSS}>
      <ExpandableContent
        height={COLLAPSED_HEIGHT_PX}
        expandedBehavior="grow"
        isExpanded={isExpanded}
        onExpandedChange={handleExpandedChange}
      >
        {children}
      </ExpandableContent>
    </div>
  );
}
