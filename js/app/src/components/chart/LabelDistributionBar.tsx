import { css } from "@emotion/react";
import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { TooltipTriggerStateContext } from "react-aria-components";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip } from "@phoenix/components";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

import { ChartTooltipItem } from "./ChartTooltip";
import { SegmentChart } from "./SegmentChart";

const containerCSS = css`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
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

export interface LabelDistributionBarProps {
  /**
   * The labels in the order they are drawn, left to right. Order them by
   * something stable (e.g. the annotation config's label order) rather than
   * by share, so a label holds its place as the shares shift.
   */
  segments: ReadonlyArray<LabelDistributionBarSegment>;
  /**
   * The box's height in pixels; the bar is centered in it. Matches the
   * Sparkline's default so the two line up in a column.
   * @default 20
   */
  height?: number;
  /**
   * The bar's own thickness in pixels.
   * @default 8
   */
  barHeight?: number;
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
 * A label distribution drawn as one horizontal stacked bar: one segment per
 * label, sized by its share. The categorical counterpart of
 * {@link Sparkline}: where a score has a trend to draw, a set of labels has a
 * split. Hovering shows every label's share and count, with the hovered
 * label emphasized. Renders nothing when no label has a share.
 */
export function LabelDistributionBar({
  segments,
  height = 20,
  barHeight = 8,
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
      css={containerCSS}
      style={{ height, maxWidth }}
      role="img"
      aria-label={
        ariaLabel != null
          ? `${ariaLabel}: ${visibleSegments
              .map(
                (segment) =>
                  `${segment.label} ${formatPercentShort(segment.fraction * 100)}`
              )
              .join(", ")}`
          : undefined
      }
      data-testid="label-distribution-bar"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoveredLabel(null)}
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
          </RichTooltip>
        </TooltipTriggerStateContext.Provider>
      ) : null}
    </div>
  );
}
