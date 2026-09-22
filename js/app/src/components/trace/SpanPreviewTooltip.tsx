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
import { SpanMetricsDetailsView } from "./SpanMetricsDetailsView";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
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
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--global-dimension-size-200);
    row-gap: var(--global-dimension-size-100);
    margin: 0;
    dt,
    dd {
      margin: 0;
    }
    dd {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
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
 * `aria-describedby` for it. The identity, timing and totals render at
 * once from what the row already holds. The breakdown is fetched only once
 * the tooltip has stayed open a moment, so a scrub down the tree fetches
 * details for the rows the pointer rests on and no others, and the totals
 * stand in until it arrives.
 */
export function SpanPreviewTooltip({ span }: SpanPreviewTooltipProps) {
  return (
    <RichTooltip
      placement="left top"
      width={300}
      className="span-preview"
      css={spanPreviewTooltipCSS}
    >
      {/* The arrow points at the row so the preview reads as its own */}
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
 * The span's token and cost totals at once, replaced by the full breakdown
 * once the tooltip has settled and the breakdown has loaded.
 */
function SpanPreviewMetrics({ span }: SpanPreviewTooltipProps) {
  const hasSettled = useSettled(DETAILS_SETTLE_MS);
  const tokenCountTotal = span.tokenCountTotal;
  const costTotal = span.costSummary?.total?.cost;
  const totals = (
    <SpanMetricsDetailsView
      tokens={
        tokenCountTotal != null && tokenCountTotal > 0
          ? { total: tokenCountTotal }
          : null
      }
      costs={costTotal != null && costTotal > 0 ? { total: costTotal } : null}
    />
  );
  if (!hasSettled) {
    return totals;
  }
  return (
    <ErrorBoundary fallback={TextErrorBoundaryFallback}>
      <Suspense fallback={totals}>
        <SpanMetricsDetailsById spanNodeId={span.id} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * When a span started and ended, and how long that took. Every span has
 * these, so a tool or chain span without tokens still has a preview worth
 * opening. Times are to the millisecond: sibling spans often start within
 * the same second.
 */
function SpanTimingDetails({
  startTime,
  endTime,
  latencyMs,
}: Pick<ISpanItem, "startTime" | "endTime" | "latencyMs">) {
  const { preciseTimeFormatter } = useTimeFormatters();
  return (
    <dl className="span-preview__timing">
      <dt>
        <Text size="S" color="text-700">
          Start
        </Text>
      </dt>
      <dd>
        <Text size="S" fontFamily="mono">
          {preciseTimeFormatter(new Date(startTime))}
        </Text>
      </dd>
      <dt>
        <Text size="S" color="text-700">
          End
        </Text>
      </dt>
      <dd>
        <Text
          size="S"
          fontFamily="mono"
          color={endTime ? undefined : "text-500"}
        >
          {endTime ? preciseTimeFormatter(new Date(endTime)) : "in progress"}
        </Text>
      </dd>
      <dt>
        <Text size="S" color="text-700">
          Latency
        </Text>
      </dt>
      <dd>
        <LatencyText latencyMs={latencyMs} size="S" showIcon={false} />
      </dd>
    </dl>
  );
}
