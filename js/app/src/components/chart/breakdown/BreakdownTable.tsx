import { css } from "@emotion/react";

import { ColorSwatch } from "@phoenix/components/color";
import { Text, VisuallyHidden } from "@phoenix/components/core/content";
import { Skeleton, TextSkeleton } from "@phoenix/components/core/loading";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

import { SegmentChart, SegmentChartSkeleton } from "../SegmentChart";
import type {
  BreakdownDimension,
  BreakdownSegment,
  BreakdownSkeletonDimension,
} from "./types";

const breakdownTableCSS = css`
  /* Five characters of the values' mono type, at about 0.6em each */
  --breakdown-table-share-width: calc(var(--global-font-size-s) * 3);
  --segment-chart-height: 3px;
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;

  th,
  td {
    padding: 0;
    vertical-align: baseline;
  }
  th {
    font-weight: normal;
    text-align: left;
    padding-bottom: var(--global-dimension-size-100);
  }
  tbody tr:not(:last-of-type) td {
    padding-bottom: var(--global-dimension-size-150);
  }
  /* The segment column takes the slack so the measures stay tight */
  .breakdown-table__segment {
    width: 100%;
  }
  .breakdown-table__segment-label {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding-right: var(--global-dimension-size-200);
    white-space: nowrap;
  }
  /* A value and its share side by side, with a bar of the share under both.
     The value column stretches to the cell so the bars read as one scale;
     the share column is fixed so the values line up down the rows */
  .breakdown-table__measure {
    display: grid;
    grid-template-columns: minmax(max-content, 1fr) var(
        --breakdown-table-share-width
      );
    column-gap: var(--global-dimension-size-100);
    row-gap: var(--global-dimension-size-50);
    padding-left: var(--global-dimension-size-200);
  }
  .breakdown-table__value,
  .breakdown-table__share {
    text-align: right;
    white-space: nowrap;
  }
  .breakdown-table__bar {
    grid-column: 1 / -1;
  }
  th .breakdown-table__value,
  th .breakdown-table__share {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
`;

const breakdownTableSkeletonCSS = css`
  /* Skeletons have no baseline; top alignment matches the loaded rows */
  th,
  td {
    vertical-align: top;
  }
  tbody .breakdown-table__value,
  tbody .breakdown-table__share {
    justify-content: end;
  }
`;

/** What a cell shows for a segment the dimension did not measure. */
const UNMEASURED = "--";

/** Segment names of a few lengths, so the rows read as a list */
const SEGMENT_LABEL_SKELETON_WIDTHS = [72, 96, 64, 88];
/** A value of five digits, or a cost to the cent */
const DEFAULT_VALUE_SKELETON_WIDTH = "6ch";
/** A share of two digits and a sign, "84%" */
const SHARE_SKELETON_WIDTH = "3ch";

export type BreakdownTableProps = {
  segments: BreakdownSegment[];
  dimensions: BreakdownDimension[];
};

/**
 * A legend of the segments as a table: one row per segment, and for each
 * dimension its value, its share of that dimension's total, and a bar of
 * that share drawn under both. The same segment reads across the row, so a
 * cache read's tokens sit beside what those tokens cost.
 *
 * Renders nothing without segments; a whole with no parts has no legend.
 */
export function BreakdownTable({ segments, dimensions }: BreakdownTableProps) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <table className="breakdown-table" css={breakdownTableCSS}>
      <BreakdownTableHead dimensions={dimensions} />
      <tbody>
        {segments.map((segment) => (
          <tr key={segment.key}>
            <th scope="row" className="breakdown-table__segment">
              <span className="breakdown-table__segment-label">
                <ColorSwatch color={segment.color} size="M" shape="square" />
                <Text size="S" elementType="span">
                  {segment.label}
                </Text>
              </span>
            </th>
            {dimensions.map((dimension) => (
              <td key={dimension.key}>
                <BreakdownMeasure segment={segment} dimension={dimension} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The column headings: a hidden one over the segments, then each
 * dimension's label over its value and a "%" over its share.
 */
function BreakdownTableHead({
  dimensions,
}: {
  dimensions: ReadonlyArray<Pick<BreakdownDimension, "key" | "label">>;
}) {
  return (
    <thead>
      <tr>
        <th scope="col" className="breakdown-table__segment">
          <VisuallyHidden>Segment</VisuallyHidden>
        </th>
        {dimensions.map((dimension) => (
          <th key={dimension.key} scope="col">
            <div className="breakdown-table__measure">
              <Text
                className="breakdown-table__value"
                size="XS"
                color="text-500"
                elementType="span"
              >
                {dimension.label}
              </Text>
              <Text
                className="breakdown-table__share"
                size="XS"
                color="text-500"
                elementType="span"
              >
                %
              </Text>
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * One segment's value in one dimension, its share, and a bar of that share.
 * A segment the dimension did not measure shows dashes over an empty track.
 */
function BreakdownMeasure({
  segment,
  dimension,
}: {
  segment: BreakdownSegment;
  dimension: BreakdownDimension;
}) {
  const value = dimension.values[segment.key];
  const share =
    value != null && dimension.total > 0 ? (value / dimension.total) * 100 : 0;
  return (
    <div className="breakdown-table__measure">
      <Text
        className="breakdown-table__value"
        size="S"
        fontFamily="mono"
        elementType="span"
      >
        {value != null ? dimension.formatter(value) : UNMEASURED}
      </Text>
      <Text
        className="breakdown-table__share"
        size="S"
        fontFamily="mono"
        color="text-500"
        elementType="span"
      >
        {value != null ? formatPercentShort(share) : UNMEASURED}
      </Text>
      <div className="breakdown-table__bar" aria-hidden="true">
        <SegmentChart
          showTrack
          totalValue={dimension.total}
          segments={[
            { name: segment.key, value: value ?? 0, color: segment.color },
          ]}
        />
      </div>
    </div>
  );
}

export type BreakdownTableSkeletonProps = {
  dimensions: BreakdownSkeletonDimension[];
  /**
   * How many segment rows to leave room for.
   * @default 3
   */
  rows?: number;
};

/** No value is longer than the total it is part of. */
function getValueSkeletonWidth(dimension: BreakdownSkeletonDimension) {
  return dimension.total != null
    ? `${dimension.total.length}ch`
    : DEFAULT_VALUE_SKELETON_WIDTH;
}

/**
 * {@link BreakdownTable} before the segments are known: the real column
 * headings over skeleton rows on the table's own grid.
 */
export function BreakdownTableSkeleton({
  dimensions,
  rows = 3,
}: BreakdownTableSkeletonProps) {
  return (
    <table
      className="breakdown-table"
      css={[breakdownTableCSS, breakdownTableSkeletonCSS]}
      aria-hidden="true"
    >
      <BreakdownTableHead dimensions={dimensions} />
      <tbody>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <tr key={rowIndex}>
            <th scope="row" className="breakdown-table__segment">
              <span className="breakdown-table__segment-label">
                <Skeleton width={8} height={8} borderRadius={2} />
                <TextSkeleton
                  size="S"
                  width={
                    SEGMENT_LABEL_SKELETON_WIDTHS[
                      rowIndex % SEGMENT_LABEL_SKELETON_WIDTHS.length
                    ]
                  }
                />
              </span>
            </th>
            {dimensions.map((dimension) => (
              <td key={dimension.key}>
                <div className="breakdown-table__measure">
                  <TextSkeleton
                    className="breakdown-table__value"
                    size="S"
                    fontFamily="mono"
                    width={getValueSkeletonWidth(dimension)}
                  />
                  <TextSkeleton
                    className="breakdown-table__share"
                    size="S"
                    fontFamily="mono"
                    width={SHARE_SKELETON_WIDTH}
                  />
                  <div className="breakdown-table__bar">
                    <SegmentChartSkeleton />
                  </div>
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
