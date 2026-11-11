import { css } from "@emotion/react";
import type { PointerEvent, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { TooltipTriggerStateContext } from "react-aria-components";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip, Text } from "@phoenix/components";
import { useDimensions } from "@phoenix/hooks/useDimensions";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

import { ChartTooltipItem } from "./ChartTooltip";
import { SegmentChart } from "./SegmentChart";

/** How far the prior tick reaches past the bar's top and bottom edges. */
const PRIOR_TICK_OVERHANG = 3;

/** The space between legend items, in pixels. */
const LEGEND_ITEM_GAP = 6;

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;

  .label-distribution-bar__plot {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .label-distribution-bar__prior-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 1px;
    /* Near-black on light and near-white on dark: reads on the accent and
       on every gray the segments use */
    background-color: var(--global-text-color-900);
    pointer-events: none;
  }
  .label-distribution-bar__legend {
    position: relative;
    /* Takes the bar's width and adds nothing to it: without this the
       nowrap items widen an auto-sized table column to fit them */
    contain: inline-size;
    display: flex;
    flex-direction: row;
    gap: ${LEGEND_ITEM_GAP}px;
    overflow: hidden;
    white-space: nowrap;
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xxs);
    line-height: 12px;
    color: var(--global-text-color-700);
  }
  /* An invisible copy of every item, laid out off-flow, to measure what fits */
  .label-distribution-bar__legend-measure {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: ${LEGEND_ITEM_GAP}px;
    visibility: hidden;
    pointer-events: none;
  }
  .label-distribution-bar__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .label-distribution-bar__legend-swatch {
    width: 6px;
    height: 6px;
    border-radius: 1px;
    flex: none;
  }
  .label-distribution-bar__legend-overflow {
    flex: none;
  }
`;

const detailListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  /* The hovered label stands out; the rest stay legible for comparison */
  li[data-active="false"] {
    opacity: 0.6;
  }
`;

/** One label's part of the distribution. */
export type LabelDistributionBarSegment = {
  /** The label, e.g. "correct". */
  label: string;
  /** The label's share of the labeled annotations, in [0, 1]. */
  fraction: number;
  /** How many annotations carry the label, when known. */
  count?: number | null;
  /** The segment's fill; keep it stable per label across rows. */
  color: string;
};

/** A share from an earlier period, marked on the bar as a tick. */
export type LabelDistributionBarPrior = {
  /** The label the share belongs to, e.g. the one leading now. */
  label: string;
  /** Its share in the earlier period, in [0, 1]; the tick's position. */
  fraction: number;
  /** When the share is from, as the tooltip words it: "in the previous 7d". */
  description: string;
};

export interface LabelDistributionBarProps {
  /**
   * The labels in the order they are drawn, left to right. Order them by
   * something stable (e.g. the annotation config's label order) rather than
   * by share, so a label holds its place as the shares shift.
   */
  segments: ReadonlyArray<LabelDistributionBarSegment>;
  /**
   * A label's share in an earlier period, drawn as a tick across the bar at
   * that share of its width, so the bar shows where a segment's edge was.
   * Omit it when there is nothing to compare against.
   */
  prior?: LabelDistributionBarPrior | null;
  /**
   * The bar's own thickness in pixels.
   * @default 8
   */
  barHeight?: number;
  /**
   * Whether a line of swatches and whole-number percents runs under the bar.
   * Items that do not fit the width are summed up as "+N".
   * @default true
   */
  showLegend?: boolean;
  /** The widest the bar grows; defaults to the width its container gives it. */
  maxWidth?: number;
  /**
   * Shown above the per-label rows in the hover tooltip, e.g. the window the
   * distribution covers.
   */
  tooltipHeader?: ReactNode;
  /** Labels the bar for assistive technology. */
  "aria-label"?: string;
}

/**
 * The smallest share a non-empty label is drawn at, so a rare label stays
 * visible (and hoverable) as a sliver instead of vanishing.
 */
const MINIMUM_SEGMENT_PERCENTAGE = 2;

function formatSegmentDetail({ fraction, count }: LabelDistributionBarSegment) {
  const share = formatPercentShort(fraction * 100);
  return count != null ? `${share} · n=${count}` : share;
}

/**
 * A share as the legend shows it: a whole number of percent with no sign,
 * and "<1" for a share that would round to nothing.
 */
export function formatLegendPercent(fraction: number): string {
  const percent = fraction * 100;
  return percent > 0 && percent < 0.5 ? "<1" : String(Math.round(percent));
}

/**
 * How many legend items fit in `availableWidth`, in order. When they don't
 * all fit, room is kept for the overflow marker after the ones shown. An
 * unmeasured width (0, e.g. before layout) fits everything.
 */
export function getFittingLegendItemCount({
  itemWidths,
  availableWidth,
  overflowWidth,
  gap,
}: {
  itemWidths: ReadonlyArray<number>;
  availableWidth: number;
  overflowWidth: number;
  gap: number;
}): number {
  if (availableWidth <= 0) {
    return itemWidths.length;
  }
  const totalWidth =
    itemWidths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(itemWidths.length - 1, 0);
  if (totalWidth <= availableWidth) {
    return itemWidths.length;
  }
  let used = overflowWidth;
  let count = 0;
  for (const width of itemWidths) {
    if (used + width + gap > availableWidth) {
      break;
    }
    used += width + gap;
    count++;
  }
  return count;
}

function LegendItem({ segment }: { segment: LabelDistributionBarSegment }) {
  return (
    <span className="label-distribution-bar__legend-item">
      <span
        className="label-distribution-bar__legend-swatch"
        style={{ backgroundColor: segment.color }}
      />
      {formatLegendPercent(segment.fraction)}
    </span>
  );
}

/**
 * The line under the bar: a swatch and a whole-number percent per label, as
 * many as fit the bar's width, then "+N" for the rest.
 */
function Legend({
  segments,
}: {
  segments: ReadonlyArray<LabelDistributionBarSegment>;
}) {
  const legendRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(legendRef);
  const [visibleCount, setVisibleCount] = useState(segments.length);
  const legendKey = segments
    .map(
      (segment) => `${segment.label}:${formatLegendPercent(segment.fraction)}`
    )
    .join("|");
  useLayoutEffect(() => {
    const legend = legendRef.current;
    const measure = measureRef.current;
    if (legend == null || measure == null) {
      return;
    }
    const items = [
      ...measure.querySelectorAll<HTMLElement>(
        ".label-distribution-bar__legend-item"
      ),
    ];
    const overflow = measure.querySelector<HTMLElement>(
      ".label-distribution-bar__legend-overflow"
    );
    setVisibleCount(
      getFittingLegendItemCount({
        itemWidths: items.map((item) => item.getBoundingClientRect().width),
        availableWidth: legend.getBoundingClientRect().width,
        overflowWidth: overflow?.getBoundingClientRect().width ?? 0,
        gap: LEGEND_ITEM_GAP,
      })
    );
  }, [legendKey, dimensions?.width]);
  const hiddenCount = segments.length - visibleCount;
  return (
    <div ref={legendRef} className="label-distribution-bar__legend" aria-hidden>
      {segments.slice(0, visibleCount).map((segment) => (
        <LegendItem key={segment.label} segment={segment} />
      ))}
      {hiddenCount > 0 ? (
        <span className="label-distribution-bar__legend-overflow">
          +{hiddenCount}
        </span>
      ) : null}
      <div ref={measureRef} className="label-distribution-bar__legend-measure">
        {segments.map((segment) => (
          <LegendItem key={segment.label} segment={segment} />
        ))}
        {/* Sized for the widest marker the hidden items could need */}
        <span className="label-distribution-bar__legend-overflow">
          +{segments.length}
        </span>
      </div>
    </div>
  );
}

/**
 * A label distribution drawn as one horizontal stacked bar: one segment per
 * label, sized by its share. The categorical counterpart of
 * {@link Sparkline}: where a score has a trend to draw, a set of labels has a
 * split. A `prior` share draws as a tick across the bar, and a legend of
 * percents runs under it. Hovering shows every label's share and count, with
 * the hovered label emphasized. Renders nothing when no label has a share.
 */
export function LabelDistributionBar({
  segments,
  prior,
  barHeight = 8,
  showLegend = true,
  maxWidth,
  tooltipHeader,
  "aria-label": ariaLabel,
}: LabelDistributionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  // Driven by the pointer tracking below rather than a TooltipTrigger, so the
  // state is created and provided here (as the Sparkline does).
  const tooltipState = useTooltipTriggerState({
    isOpen: hoveredLabel != null,
    delay: 0,
  });
  const visibleSegments = segments.filter((segment) => segment.fraction > 0);
  if (visibleSegments.length === 0) {
    return null;
  }
  const priorText =
    prior != null
      ? `tick: ${prior.label} ${formatPercentShort(prior.fraction * 100)} ${prior.description}`
      : null;
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // The SegmentChart draws the visible segments in order; find the one
    // under the pointer, or the nearest when it sits in a gap between two.
    const elements = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        ".segment-chart__segment"
      ),
    ];
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const distance =
        event.clientX < rect.left
          ? rect.left - event.clientX
          : event.clientX > rect.right
            ? event.clientX - rect.right
            : 0;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setHoveredLabel(visibleSegments[nearestIndex]?.label ?? null);
  };
  return (
    <div
      ref={barRef}
      className="label-distribution-bar"
      css={containerCSS}
      style={{ maxWidth }}
      role="img"
      aria-label={
        ariaLabel != null
          ? `${ariaLabel}: ${visibleSegments
              .map(
                (segment) =>
                  `${segment.label} ${formatPercentShort(segment.fraction * 100)}`
              )
              .join(", ")}${priorText != null ? `; ${priorText}` : ""}`
          : undefined
      }
      data-testid="label-distribution-bar"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoveredLabel(null)}
    >
      <div
        className="label-distribution-bar__plot"
        style={{ height: barHeight + 2 * PRIOR_TICK_OVERHANG }}
      >
        <SegmentChart
          height={barHeight}
          minimumSegmentPercentage={MINIMUM_SEGMENT_PERCENTAGE}
          segments={visibleSegments.map((segment) => ({
            name: segment.label,
            value: segment.fraction,
            color: segment.color,
          }))}
        />
        {prior != null ? (
          <div
            className="label-distribution-bar__prior-tick"
            style={{
              left: `${Math.min(1, Math.max(0, prior.fraction)) * 100}%`,
            }}
          />
        ) : null}
      </div>
      {showLegend ? <Legend segments={visibleSegments} /> : null}
      {hoveredLabel != null ? (
        <TooltipTriggerStateContext.Provider value={tooltipState}>
          <RichTooltip triggerRef={barRef} placement="top" offset={4}>
            {tooltipHeader}
            <ul css={detailListCSS}>
              {visibleSegments.map((segment) => (
                <li
                  key={segment.label}
                  data-active={segment.label === hoveredLabel}
                >
                  <ChartTooltipItem
                    color={segment.color}
                    shape="square"
                    name={segment.label}
                    value={formatSegmentDetail(segment)}
                  />
                </li>
              ))}
            </ul>
            {priorText != null ? (
              <Text size="S" color="text-700">
                {priorText}
              </Text>
            ) : null}
          </RichTooltip>
        </TooltipTriggerStateContext.Provider>
      ) : null}
    </div>
  );
}
