import { css, keyframes } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

/**
 * A count, an icon-only flag, or absent.
 *
 * - `number` (> 0) renders the icon followed by the count.
 * - `true` renders the icon alone (used by a single tool call, which has a
 *   state but no meaningful count — e.g. one completed call is just a check).
 * - `undefined`, `false`, or `0` omits the segment.
 */
type SummaryValue = number | boolean | undefined;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const summaryCSS = css`
  display: inline-flex;
  align-items: center;
  /* The summary is inline-flex, so it would otherwise sit on its container's
     text baseline — leaving the line box's descender gap below it and pushing
     the icon visually high. Align to the middle so it centers in the row. */
  vertical-align: middle;
  gap: var(--global-dimension-size-100);
  font-size: var(--global-font-size-xs);
  font-variant-numeric: tabular-nums;
  line-height: 1;

  .tool-exec-summary__segment {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }

  /* Completed and running recede in the secondary color. */
  .tool-exec-summary__segment[data-state="completed"],
  .tool-exec-summary__segment[data-state="running"] {
    color: var(--tool-call-secondary-color);
  }

  /* Failed draws the eye: a red X, but the count stays in the default text
     color so the number reads clearly. */
  .tool-exec-summary__segment[data-state="failed"] {
    color: var(--global-text-color-900);
  }

  .tool-exec-summary__segment[data-state="failed"] .tool-exec-summary__icon {
    color: var(--tool-call-error-color);
  }

  .tool-exec-summary__icon {
    display: inline-flex;
    width: 13px;
    height: 13px;
    font-size: 13px;
  }

  .tool-exec-summary__spinner {
    width: 11px;
    height: 11px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
  }
`;

type Segment = {
  state: "completed" | "failed" | "running";
  count?: number;
};

/** Resolves a {@link SummaryValue} into a segment, or `null` to omit it. */
function toSegment(
  state: Segment["state"],
  value: SummaryValue
): Segment | null {
  if (value === true) {
    return { state };
  }
  if (typeof value === "number" && value > 0) {
    return { state, count: value };
  }
  return null;
}

function segmentLabel({ state, count }: Segment): string {
  return count == null ? state : `${count} ${state}`;
}

/**
 * Compact, diff-stat-style summary of tool execution outcomes (think `+29 -23`).
 * Renders a row of `[icon][count]` segments:
 *
 * - **completed** — a checkmark in the secondary color, with the count beside it
 * - **failed** — a red X, with the count in the default text color
 * - **running** — a spinner, with the count beside it
 *
 * Pass a count for an aggregate (a pool of calls) or `true` for a single call
 * that has the state but no meaningful count (a lone completed call is just a
 * check). Renders nothing when no segment applies.
 *
 * Note: this models only completed / failed / running. States such as
 * `approval-requested` ("Awaiting approval") and `output-denied` ("Denied")
 * are intentionally out of scope — callers handle those separately.
 */
export function ToolExecutionSummary({
  completed,
  failed,
  running,
}: {
  completed?: SummaryValue;
  failed?: SummaryValue;
  running?: SummaryValue;
}) {
  const segments = [
    toSegment("completed", completed),
    toSegment("failed", failed),
    toSegment("running", running),
  ].filter((segment): segment is Segment => segment !== null);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span
      className="tool-exec-summary"
      css={summaryCSS}
      aria-label={segments.map(segmentLabel).join(", ")}
    >
      {segments.map((segment) => (
        <span
          key={segment.state}
          className="tool-exec-summary__segment"
          data-state={segment.state}
          aria-hidden
        >
          {segment.state === "running" ? (
            <span className="tool-exec-summary__spinner" />
          ) : (
            <Icon
              svg={
                segment.state === "completed" ? (
                  <Icons.Checkmark />
                ) : (
                  <Icons.Close />
                )
              }
              className="tool-exec-summary__icon"
            />
          )}
          {segment.count != null ? <span>{segment.count}</span> : null}
        </span>
      ))}
    </span>
  );
}
