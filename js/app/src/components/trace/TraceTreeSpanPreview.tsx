import { css } from "@emotion/react";
import type { FocusEvent, PointerEvent, PropsWithChildren } from "react";
import { Suspense, useEffect, useRef, useState } from "react";

import { ErrorBoundary, Popover, Text } from "@phoenix/components";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import { useTimeFormatters } from "@phoenix/hooks";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanMetricsDetailsById } from "./SpanMetricsDetails";
import { SpanMetricsDetailsView } from "./SpanMetricsDetailsView";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import type { ISpanItem } from "./types";

const SPAN_NODE_ID_ATTRIBUTE = "data-span-node-id";

/**
 * How long the pointer rests on a row before that span's full breakdown is
 * fetched. The preview itself opens at once with what the tree already
 * knows, so a scrub down the tree shows every span's totals and fetches
 * details only for the rows the pointer settles on.
 */
const DETAILS_SETTLE_MS = 120;

/**
 * Marks an element as a span the preview can describe. Spread onto each
 * tree row; the region finds the row under the pointer by this attribute.
 */
export function spanPreviewTargetProps(spanNodeId: string) {
  return { [SPAN_NODE_ID_ATTRIBUTE]: spanNodeId };
}

const regionCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

type TraceTreeSpanPreviewRegionProps = PropsWithChildren<{
  /** The spans the rows inside draw, so a hovered row can be looked up. */
  spans: ISpanItem[];
}>;

/**
 * Hover any row of the tree inside and one popover beside the tree
 * describes that span: its name, when it ran and for how long, then its
 * token and cost breakdown.
 *
 * @remarks
 * The rows own no tooltip. The region listens for pointer and focus events
 * bubbling from rows marked with {@link spanPreviewTargetProps}, so hover
 * state lives here and a hover re-renders the popover alone, never the
 * tree. The popover is anchored to the hovered row and follows it as the
 * pointer moves. Leaving the region, scrolling it, or pressing Escape
 * dismisses the preview.
 */
export function TraceTreeSpanPreviewRegion({
  spans,
  children,
}: TraceTreeSpanPreviewRegionProps) {
  const [hoveredSpan, setHoveredSpan] = useState<ISpanItem | null>(null);
  const [settledSpanId, setSettledSpanId] = useState<string | null>(null);
  // The row the popover is anchored to. Kept in a ref rather than state so
  // the exit animation still has an anchor after the hover is cleared.
  const anchorRef = useRef<HTMLElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spansById = new Map(spans.map((span) => [span.id, span]));

  useEffect(() => {
    return () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
      }
    };
  }, []);

  const clearSettleTimer = () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };

  const previewTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return;
    }
    const row = target.closest<HTMLElement>(`[${SPAN_NODE_ID_ATTRIBUTE}]`);
    const span = row
      ? spansById.get(row.getAttribute(SPAN_NODE_ID_ATTRIBUTE) ?? "")
      : undefined;
    if (!row || !span || span.id === hoveredSpan?.id) {
      return;
    }
    anchorRef.current = row;
    setHoveredSpan(span);
    clearSettleTimer();
    settleTimer.current = setTimeout(() => {
      setSettledSpanId(span.id);
    }, DETAILS_SETTLE_MS);
  };

  const dismiss = () => {
    clearSettleTimer();
    setHoveredSpan(null);
    setSettledSpanId(null);
  };

  return (
    <div
      className="trace-tree-span-preview-region"
      css={regionCSS}
      onPointerOver={(event: PointerEvent<HTMLDivElement>) => {
        previewTarget(event.target);
      }}
      onPointerLeave={dismiss}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        previewTarget(event.target);
      }}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          dismiss();
        }
      }}
    >
      {children}
      <Popover
        isNonModal
        isOpen={hoveredSpan != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            dismiss();
          }
        }}
        triggerRef={anchorRef}
        placement="left top"
        offset={8}
        className="trace-tree-span-preview"
      >
        {hoveredSpan ? (
          <SpanPreviewCard
            key={hoveredSpan.id}
            span={hoveredSpan}
            showDetails={settledSpanId === hoveredSpan.id}
          />
        ) : null}
      </Popover>
    </div>
  );
}

const cardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  width: 300px;
  padding: var(--global-dimension-size-200);
  box-sizing: border-box;

  .trace-tree-span-preview__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .trace-tree-span-preview__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trace-tree-span-preview__timing {
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
  .trace-tree-span-preview__timing + * {
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

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
    <dl className="trace-tree-span-preview__timing">
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

/**
 * What the preview shows for one span: its identity, its timing, then its
 * metrics.
 *
 * @remarks
 * The metrics render at once from the totals the tree row already carries.
 * Once `showDetails` is set the full breakdown is fetched, and those totals
 * stand in until it arrives, so the card never blanks out or shows a
 * spinner while the pointer moves.
 */
function SpanPreviewCard({
  span,
  showDetails,
}: {
  span: ISpanItem;
  showDetails: boolean;
}) {
  const tokenCountTotal = span.tokenCountTotal;
  const costTotal = span.costSummary?.total?.cost;
  const summary = (
    <SpanMetricsDetailsView
      tokens={
        tokenCountTotal != null && tokenCountTotal > 0
          ? { total: tokenCountTotal }
          : null
      }
      costs={costTotal != null && costTotal > 0 ? { total: costTotal } : null}
    />
  );
  return (
    <div className="trace-tree-span-preview__card" css={cardCSS}>
      <header className="trace-tree-span-preview__header">
        <SpanKindIcon spanKind={span.spanKind} />
        <Text
          weight="heavy"
          className="trace-tree-span-preview__name"
          title={span.name}
        >
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
      {showDetails ? (
        <ErrorBoundary fallback={TextErrorBoundaryFallback}>
          <Suspense fallback={summary}>
            <SpanMetricsDetailsById spanNodeId={span.id} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        summary
      )}
    </div>
  );
}
