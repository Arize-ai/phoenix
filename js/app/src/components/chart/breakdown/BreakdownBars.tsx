import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";
import { TextSkeleton } from "@phoenix/components/core/loading";
import { isPositiveNumber } from "@phoenix/utils/numberUtils";

import { useSequentialChartColors } from "../colors";
import { SegmentChart, SegmentChartSkeleton } from "../SegmentChart";
import type {
  BreakdownDimension,
  BreakdownSegment,
  BreakdownSkeletonDimension,
} from "./types";

const breakdownBarsCSS = css`
  --segment-chart-height: 10px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: var(--global-dimension-size-150);
  row-gap: var(--global-dimension-size-100);
  align-items: start;

  .breakdown-bars__row {
    display: contents;
  }
  /* Centered on the bar, not on the bar plus its marker lane */
  .breakdown-bars__label,
  .breakdown-bars__total {
    display: flex;
    align-items: center;
    height: var(--segment-chart-height);
    white-space: nowrap;
  }
  .breakdown-bars__total {
    justify-content: end;
  }
`;

/** A total of five digits, or a cost to the cent */
const TOTAL_SKELETON_WIDTH = "6ch";

export type BreakdownBarsProps = {
  segments: BreakdownSegment[];
  dimensions: BreakdownDimension[];
};

/**
 * The same parts measured several ways: one bar per dimension, every bar
 * split into the same segments in the same colors, each with its label and
 * total.
 *
 * Where a {@link SegmentChart} answers "how does this whole divide?",
 * BreakdownBars answers "how does the division change from one measure to
 * the next?" The bars are stacked so a segment can be read down them: cache
 * reads that are most of the tokens but little of the cost. Pair it with
 * {@link BreakdownTable} beneath, which is its legend and gives the numbers
 * behind each segment.
 *
 * Use it when there are two or more dimensions to compare. A single
 * dimension does not need it: one SegmentChart beside a label of the
 * caller's own says the same thing with less.
 *
 * A dimension none of whose segments carry a value is drawn as one neutral
 * bar of its total. Every bar keeps its marker lane, with or without a
 * marker, so the bars are one height and so is the skeleton.
 */
export function BreakdownBars({ segments, dimensions }: BreakdownBarsProps) {
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
              // Keeps a sliver visible
              minimumSegmentPercentage={3}
              totalValue={dimension.total}
              markerValues={dimension.markerValues}
              showMarkerLane
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
 * {@link BreakdownBars} before the segments are known: each dimension keeps
 * its label and, when given, its total, over a skeleton bar.
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
          <SegmentChartSkeleton showMarkerLane />
          <div className="breakdown-bars__total">
            {dimension.total != null ? (
              <Text size="S" fontFamily="mono">
                {dimension.total}
              </Text>
            ) : (
              <TextSkeleton
                size="S"
                fontFamily="mono"
                width={TOTAL_SKELETON_WIDTH}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
