import { css, keyframes } from "@emotion/react";
import { getToolName, isToolUIPart } from "ai";
import { type CSSProperties, useMemo, useState } from "react";

import { Icon, Icons } from "@phoenix/components";

import {
  getToolPartPreview,
  shouldAutoOpenToolPart,
  ToolPart,
  type ToolPartType,
} from "./ToolPart";
import { TOOL_CALL_SUMMARY_LANE_RULES } from "./ToolPartPrimitives";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

const TERMINAL_STATES = new Set<ToolState>([
  "output-available",
  "output-error",
  "output-denied",
]);

const toolPoolItemFadeUp = keyframes`
  from {
    opacity: 0.5;
    transform: translate(-3px, 0px);
  }

  to {
    opacity: 1;
    transform: translate(0, 0);
  }
`;

const toolPoolCSS = css`
  width: 100%;
  margin-top: var(--global-dimension-size-150);
  border-left: 1px solid var(--tool-call-body-border-color);
  transition: border-color 150ms ease;

  &[data-header-active="true"] {
    border-left-color: var(--tool-call-border-color-hover);
    transition: none;
  }

  &:has(+ :not(.tool-pool)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  .tool-pool__header {
    cursor: pointer;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0
      var(--global-dimension-size-100);
    user-select: none;

    &:focus-visible {
      outline: 2px solid var(--global-color-primary);
      outline-offset: 2px;
    }
  }

  .tool-pool__header[aria-expanded="false"] {
    padding-bottom: var(--global-dimension-size-100);
  }

  .tool-pool__title-row {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    color: var(--tool-call-title-color);
    font-size: var(--global-font-size-xs);
    min-width: 0;
  }

  .tool-pool__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-weight: 400;
    white-space: nowrap;
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.titleFlex};
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.titleMinWidth};
    max-width: ${TOOL_CALL_SUMMARY_LANE_RULES.titleMaxWidth};
    color: var(--global-text-color-800);
  }

  .tool-pool__title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tool-pool__chevron {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tool-call-secondary-color);
    font-size: 18px;
    transition:
      transform 150ms ease,
      color 150ms ease;
  }

  .tool-pool__chevron[data-expanded="true"] {
    transform: rotate(0deg);
  }

  .tool-pool__chevron[data-expanded="false"] {
    transform: rotate(-90deg);
  }

  .tool-pool__status {
    margin-left: auto;
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.statusFlex};
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.statusMinWidth};
    max-width: ${TOOL_CALL_SUMMARY_LANE_RULES.statusMaxWidth};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    font-weight: 400;
    font-size: var(--global-font-size-xs);
    color: var(--tool-call-secondary-color);
    padding-inline-end: var(--global-dimension-size-50);
    transition: color 150ms ease;
  }

  .tool-pool__status[data-variant="danger"] {
    color: var(--tool-call-error-color);
  }

  .tool-pool__breakdown {
    flex: ${TOOL_CALL_SUMMARY_LANE_RULES.middleFlex};
    min-width: ${TOOL_CALL_SUMMARY_LANE_RULES.middleMinWidth};
    font-weight: 400;
    font-family: var(--ac-global-font-family-code);
    color: var(--tool-call-secondary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 150ms ease;
  }

  .tool-pool__header:hover .tool-pool__breakdown,
  .tool-pool__header:hover .tool-pool__status:not([data-variant]),
  .tool-pool__header:hover .tool-pool__chevron,
  .tool-pool__header:focus-visible .tool-pool__chevron {
    color: var(--tool-call-title-color);
    transition: none;
  }

  .tool-pool__body {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-100)
      var(--global-dimension-size-100) var(--global-dimension-size-150);

    & > .tool-pool__item {
      opacity: 0;
      animation: ${toolPoolItemFadeUp} 200ms cubic-bezier(0.18, 0.9, 0.22, 1)
        var(--tool-pool-item-delay, 0ms) forwards;
    }

    & > .tool-pool__item > .tool-part {
      margin-top: 0;
    }
  }
`;

/**
 * Computes summary statistics for a group of tool parts: counts by tool name,
 * counts by terminal status, and whether all tools have finished.
 */
function useToolPoolStats(parts: ToolPartType[]) {
  return useMemo(() => {
    const byName = new Map<string, number>();
    let completed = 0;
    let failed = 0;
    let running = 0;

    for (const part of parts) {
      if (!isToolUIPart(part)) continue;
      const name = getToolName(part);
      byName.set(name, (byName.get(name) ?? 0) + 1);

      if (part.state === "output-available") {
        completed++;
      } else if (part.state === "output-error") {
        failed++;
      } else if (part.state === "output-denied") {
        // count denied as failed for display purposes
        failed++;
      } else {
        running++;
      }
    }

    const allDone = parts.every(
      (p) => isToolUIPart(p) && TERMINAL_STATES.has(p.state as ToolState)
    );

    return { byName, completed, failed, running, allDone, total: parts.length };
  }, [parts]);
}

/**
 * Builds a compact status suffix for the pool title.
 *
 * Examples:
 *  - "completed"
 *  - "3 of 8 running..."
 *  - "7 completed, 1 failed"
 */
function formatPoolStatus({
  completed,
  failed,
  running,
  total,
}: {
  completed: number;
  failed: number;
  running: number;
  total: number;
}): { text: string; variant?: "danger" } {
  if (running > 0) {
    return {
      text: `${completed + failed} of ${total} done, ${running} Running\u2026`,
    };
  }
  if (failed > 0) {
    return {
      text: `${completed} Completed, ${failed} Failed`,
      variant: "danger",
    };
  }
  return { text: "Completed" };
}

/**
 * Collapsed pool for a run of consecutive tool calls. Shows a compact summary
 * header with tool-type breakdown badges. Expands to reveal individual
 * {@link ToolPart} details.
 *
 * Starts collapsed, except for tools that explicitly request auto-open after
 * they have enough streamed input to render meaningful details.
 */
export function ToolPartGroup({ parts }: { parts: ToolPartType[] }) {
  const stats = useToolPoolStats(parts);
  const hasAutoOpenTool = parts.some(
    (part) =>
      isToolUIPart(part) &&
      shouldAutoOpenToolPart(part, getToolPartPreview(part))
  );
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  // Auto-open is only the initial/default state. Once the user toggles the
  // group, their manual choice must win even if a child tool still requests
  // auto-open (for example, an edit_prompt_instance diff that remains previewable).
  const isRenderedExpanded = manualExpanded ?? hasAutoOpenTool;
  const [isHeaderActive, setIsHeaderActive] = useState(false);

  const { text: statusText, variant: statusVariant } = formatPoolStatus(stats);
  const breakdownText = Array.from(stats.byName.entries())
    .map(([name, count]) => `${name}${count > 1 ? ` \u00D7${count}` : ""}`)
    .join(", ");

  const handleToggle = () => {
    setManualExpanded(
      (previousManualExpanded) => !(previousManualExpanded ?? hasAutoOpenTool)
    );
  };

  return (
    <div
      className="tool-pool"
      css={toolPoolCSS}
      data-header-active={isHeaderActive}
    >
      <div
        className="tool-pool__header"
        role="button"
        tabIndex={0}
        aria-expanded={isRenderedExpanded}
        onMouseEnter={() => setIsHeaderActive(true)}
        onMouseLeave={() => setIsHeaderActive(false)}
        onFocus={() => setIsHeaderActive(true)}
        onBlur={() => setIsHeaderActive(false)}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="tool-pool__title-row">
          <span className="tool-pool__title">
            <Icon
              svg={<Icons.ChevronDown />}
              className="tool-pool__chevron"
              data-expanded={isRenderedExpanded}
            />
            <span className="tool-pool__title-text">
              {stats.total} tool call{stats.total === 1 ? "" : "s"}
            </span>
          </span>
          <span className="tool-pool__breakdown">{breakdownText}</span>
          <span
            className="tool-pool__status"
            data-variant={statusVariant ?? undefined}
          >
            {statusText}
          </span>
        </div>
      </div>
      {isRenderedExpanded ? (
        <div className="tool-pool__body">
          {parts.map((part, i) => (
            <div
              key={i}
              className="tool-pool__item"
              style={
                {
                  "--tool-pool-item-delay": `${i * 40}ms`,
                } as CSSProperties
              }
            >
              <ToolPart part={part} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
