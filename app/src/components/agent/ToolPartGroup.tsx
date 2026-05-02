import { css } from "@emotion/react";
import { getToolName, isToolUIPart } from "ai";
import { useMemo, useState } from "react";

import { Icon, Icons } from "@phoenix/components";

import { ToolPart, type ToolPartType } from "./ToolPart";

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

const toolPoolCSS = css`
  width: 100%;
  margin-top: var(--global-dimension-size-150);
  border: 1px solid var(--tool-call-border-color);
  border-radius: var(--global-rounding-medium);
  background: var(--tool-call-background-color);
  overflow: hidden;

  &:has(+ :not(.tool-pool)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  .tool-pool__header {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background: var(--tool-call-header-background-color);
    user-select: none;
    transition: background 150ms ease;

    &:hover {
      background: var(--tool-call-header-background-color-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--global-color-primary);
      outline-offset: -2px;
    }
  }

  .tool-pool__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
  }

  .tool-pool__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--tool-call-title-color);
  }

  .tool-pool__chevron {
    font-size: 12px;
    color: var(--tool-call-secondary-color);
    transition: transform 150ms ease;
  }

  .tool-pool__chevron[data-expanded="true"] {
    transform: rotate(0deg);
  }

  .tool-pool__chevron[data-expanded="false"] {
    transform: rotate(-90deg);
  }

  .tool-pool__status {
    font-weight: 400;
    font-size: var(--global-font-size-xs);
    color: var(--tool-call-secondary-color);
  }

  .tool-pool__status[data-tone="error"] {
    color: var(--tool-call-error-color);
  }

  .tool-pool__breakdown {
    font-size: var(--global-font-size-xs);
    font-weight: 400;
    color: var(--tool-call-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .tool-pool__body {
    border-top: 1px solid var(--tool-call-body-border-color);

    & > .tool-part {
      margin-top: 0;
      border: none;
      border-radius: 0;
      border-bottom: 1px solid var(--tool-call-body-border-color);

      &:last-child {
        border-bottom: none;
      }

      /* Remove inner border-radius when nested inside a pool */
      summary {
        border-radius: 0;
      }
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
}): { text: string; tone?: "error" } {
  if (running > 0) {
    return {
      text: `${completed + failed} of ${total} done, ${running} Running\u2026`,
    };
  }
  if (failed > 0) {
    return {
      text: `${completed} Completed, ${failed} Failed`,
      tone: "error",
    };
  }
  return { text: "Completed" };
}

/**
 * Collapsed pool for a run of consecutive tool calls. Shows a compact summary
 * header with tool-type breakdown badges. Expands to reveal individual
 * {@link ToolPart} details.
 *
 * Starts collapsed. The user controls open/close exclusively — no automatic
 * toggling as tool states change, which avoids jitter during rapid tool
 * execution.
 */
export function ToolPartGroup({ parts }: { parts: ToolPartType[] }) {
  const stats = useToolPoolStats(parts);
  const [isExpanded, setIsExpanded] = useState(false);

  const { text: statusText, tone: statusTone } = formatPoolStatus(stats);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="tool-pool" css={toolPoolCSS}>
      <div
        className="tool-pool__header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
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
              data-expanded={isExpanded}
            />
            <Icon
              svg={<Icons.WrenchOutline />}
              css={css`
                font-size: 0.75rem;
              `}
            />
            {stats.total} tool call{stats.total === 1 ? "" : "s"}
            <span className="tool-pool__breakdown">
              {Array.from(stats.byName.entries())
                .map(
                  ([name, count]) =>
                    `${name}${count > 1 ? ` \u00D7${count}` : ""}`
                )
                .join(", ")}
              {stats.failed > 0 ? ` \u2014 ${stats.failed} failed` : ""}
            </span>
          </span>
          <span
            className="tool-pool__status"
            data-tone={statusTone ?? undefined}
          >
            {statusText}
          </span>
        </div>
      </div>
      {isExpanded ? (
        <div className="tool-pool__body">
          {parts.map((part, i) => (
            <ToolPart key={i} part={part} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
