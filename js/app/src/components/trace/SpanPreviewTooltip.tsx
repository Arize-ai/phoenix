import { css } from "@emotion/react";
import { Suspense } from "react";

import {
  ErrorBoundary,
  RichTooltip,
  Text,
  TooltipArrow,
} from "@phoenix/components";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import { useSettled, useTimeFormatters } from "@phoenix/hooks";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanMetricsDetailsById } from "./SpanMetricsDetails";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import {
  TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
  TokenDetailsBreakdownSkeleton,
} from "./TokenDetailsBreakdown";
import type { ISpanItem } from "./types";

/**
 * How long a tooltip stays open before its span's breakdown is fetched.
 * React Aria opens each tooltip at once after the first, so without this a
 * scrub down the tree would fetch details for every row it crossed.
 */
const DETAILS_SETTLE_MS = 150;

/**
 * The preview follows the pointer from row to row, so it neither fades in
 * nor lingers: each hop shows the next span at once.
 */
const spanPreviewTooltipCSS = css`
  transition: none;
  &[data-entering],
  &[data-exiting] {
    transform: none;
    opacity: 1;
  }
`;

const cardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);

  .span-preview__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .span-preview__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .span-preview__timing {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--global-dimension-size-200);
    white-space: nowrap;
  }
  /* The breakdowns follow the timing under a rule, as sections do inside them */
  .span-preview__timing + * {
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

export type SpanPreviewTooltipProps = {
  /** The span as the trace tree holds it. */
  span: ISpanItem;
};

/**
 * A rich tooltip that describes one span of the trace tree: its name, when
 * it ran and for how long, then its token and cost breakdown.
 *
 * @remarks
 * Render it as the tooltip of a `TooltipTrigger` around the row, which
 * anchors it beside the row and wires the row's hover, focus, Escape and
 * `aria-describedby` for it. Every row's box starts at the tree's edge, so
 * the preview holds one horizontal position as the pointer moves down the
 * tree whatever the nesting, and the arrow and the row's hover fill, which
 * reaches that same edge, tie the two together.
 *
 * The identity, timing and totals render at once from what the row already
 * holds. The breakdown is fetched only once the tooltip has stayed open a
 * moment, so a scrub down the tree fetches details for the rows the pointer
 * rests on and no others; until it arrives, a skeleton of the breakdown
 * holds its place around the totals.
 */
export function SpanPreviewTooltip({ span }: SpanPreviewTooltipProps) {
  return (
    <RichTooltip
      placement="left top"
      width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
      className="span-preview"
      css={spanPreviewTooltipCSS}
    >
      {/* The arrow points at the row the preview describes */}
      <TooltipArrow />
      <div css={cardCSS}>
        <header className="span-preview__header">
          <SpanKindIcon spanKind={span.spanKind} />
          <Text weight="heavy" className="span-preview__name" title={span.name}>
            {span.name}
          </Text>
          {span.statusCode === "ERROR" ? (
            <SpanStatusCodeIcon statusCode="ERROR" />
          ) : null}
        </header>
        <SpanTimingDetails
          startTime={span.startTime}
          endTime={span.endTime}
          latencyMs={span.latencyMs}
        />
        <SpanPreviewMetrics span={span} />
      </div>
    </RichTooltip>
  );
}

/**
 * The span's token and cost totals at once, in a skeleton of the breakdown,
 * replaced by the full breakdown once the tooltip has settled and the
 * breakdown has loaded.
 */
function SpanPreviewMetrics({ span }: SpanPreviewTooltipProps) {
  const hasSettled = useSettled(DETAILS_SETTLE_MS);
  const skeleton = (
    <TokenDetailsBreakdownSkeleton
      tokens={{ total: span.tokenCountTotal }}
      costs={{ total: span.costSummary?.total?.cost }}
    />
  );
  if (!hasSettled) {
    return skeleton;
  }
  return (
    <ErrorBoundary fallback={TextErrorBoundaryFallback}>
      <Suspense fallback={skeleton}>
        <SpanMetricsDetailsById spanNodeId={span.id} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * One line: when the span started and ended on the left, and how long that
 * took on the right. Every span has these, so a tool or chain span without
 * tokens still has a preview worth opening. Times stop at the second: the
 * latency beside them carries the finer resolution.
 */
function SpanTimingDetails({
  startTime,
  endTime,
  latencyMs,
}: Pick<ISpanItem, "startTime" | "endTime" | "latencyMs">) {
  const { timeOfDayFormatter } = useTimeFormatters();
  return (
    <div className="span-preview__timing">
      <Text size="S" fontFamily="mono" color="text-700">
        {timeOfDayFormatter(new Date(startTime))}
        {" to "}
        {endTime ? timeOfDayFormatter(new Date(endTime)) : "now"}
      </Text>
      <LatencyText latencyMs={latencyMs} size="S" showIcon={false} />
    </div>
  );
}
