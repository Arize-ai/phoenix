import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";
import { pulseAnimation, TextSkeleton } from "@phoenix/components/core/loading";
import { isPositiveNumber } from "@phoenix/utils/numberUtils";

import { useSequentialChartColors } from "../colors";
import { SegmentChart } from "../SegmentChart";
import type {
  BreakdownDimension,
  BreakdownSegment,
  BreakdownSkeletonDimension,
} from "./types";

/** The height of each bar in pixels. */
const BAR_HEIGHT = 10;

const breakdownBarsCSS = css`
  --breakdown-bar-height: ${BAR_HEIGHT}px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: var(--global-dimension-size-150);
  row-gap: var(--global-dimension-size-100);
  align-items: start;

  /* A row is a grouping in the markup only; its cells sit in the shared
     grid, and an element with no box carries no role of its own */
  .breakdown-bars__row {
    display: contents;
  }
  /* Centered on the bar, not on the bar plus the marker lane beneath it */
  .breakdown-bars__label,
  .breakdown-bars__total {
    display: flex;
    align-items: center;
    height: var(--breakdown-bar-height);
    white-space: nowrap;
  }
  .breakdown-bars__total {
    justify-content: end;
  }
  /* Pulses the bar alone; its label and total are real and stay steady */
  .breakdown-bars__bar-skeleton {
    ${pulseAnimation}
  }
`;

/** The fill of a bar whose segments have yet to load; the skeletons' gray */
const SKELETON_FILL = "var(--global-color-gray-200)";

/** Wide enough for a total of five or six digits or a cost to the cent */
const TOTAL_SKELETON_WIDTH = 48;

export type BreakdownBarsProps = {
  segments: BreakdownSegment[];
  dimensions: BreakdownDimension[];
};

/**
 * One labeled bar per dimension, each split into the same segments in the
 * same colors, with the dimension's total at its end. Lined up this way, the
 * bars show how a segment's share shifts from one dimension to the next:
 * cache reads that are most of the tokens but little of the cost.
 *
 * A dimension none of whose segments carry a value is still drawn, as a
 * single neutral bar of its total, so a whole that has yet to be broken down
 * has the same shape as one that has.
 */
export function BreakdownBars({ segments, dimensions }: BreakdownBarsProps) {
  // A whole whose parts are not known is drawn in the charts' neutral
  const unsegmentedColor = useSequentialChartColors().gray500;
  return (
    <div className="breakdown-bars" css={breakdownBarsCSS}>
      {dimensions.map((dimension) => {
        const barSegments = segments.flatMap((segment) => {
          const value = dimension.values[segment.key];
          return isPositiveNumber(value)
            ? [{ name: segment.key, value, color: segment.color }]
            : [];
        });
        return (
          <div key={dimension.key} className="breakdown-bars__row">
            <div className="breakdown-bars__label">
              <Text size="S" color="text-700">
                {dimension.label}
              </Text>
            </div>
            <SegmentChart
              height={BAR_HEIGHT}
              // Wide enough that a sliver clears the bar's rounded end
              minimumSegmentPercentage={3}
              totalValue={dimension.total}
              markerValues={dimension.markerValues}
              segments={
                barSegments.length > 0
                  ? barSegments
                  : [
                      {
                        name: dimension.key,
                        value: dimension.total,
                        color: unsegmentedColor,
                      },
                    ]
              }
            />
            <div className="breakdown-bars__total">
              <Text size="S" fontFamily="mono">
                {dimension.formatter(dimension.total)}
              </Text>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type BreakdownBarsSkeletonProps = {
  dimensions: BreakdownSkeletonDimension[];
};

/**
 * {@link BreakdownBars} before the segments are known. Each dimension keeps
 * its label and, when given, its total, and its bar is drawn as one skeleton
 * bar with the marker lane held under it, so the loaded bars take exactly
 * the room the skeleton did.
 */
export function BreakdownBarsSkeleton({
  dimensions,
}: BreakdownBarsSkeletonProps) {
  return (
    <div className="breakdown-bars" css={breakdownBarsCSS} aria-busy="true">
      {dimensions.map((dimension) => (
        <div key={dimension.key} className="breakdown-bars__row">
          <div className="breakdown-bars__label">
            <Text size="S" color="text-700">
              {dimension.label}
            </Text>
          </div>
          <div className="breakdown-bars__bar-skeleton" aria-hidden="true">
            <SegmentChart
              height={BAR_HEIGHT}
              showMarkerLane
              segments={[
                { name: dimension.key, value: 1, color: SKELETON_FILL },
              ]}
            />
          </div>
          <div className="breakdown-bars__total">
            {dimension.total != null ? (
              <Text size="S" fontFamily="mono">
                {dimension.total}
              </Text>
            ) : (
              <TextSkeleton size="S" width={TOTAL_SKELETON_WIDTH} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
