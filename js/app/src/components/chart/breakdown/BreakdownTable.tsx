import { css } from "@emotion/react";

import { ColorSwatch } from "@phoenix/components/color";
import { Text, VisuallyHidden } from "@phoenix/components/core/content";
import { Skeleton, TextSkeleton } from "@phoenix/components/core/loading";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

import { SegmentChart } from "../SegmentChart";
import type {
  BreakdownDimension,
  BreakdownSegment,
  BreakdownSkeletonDimension,
} from "./types";

const breakdownTableCSS = css`
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
  /* Each measure is a value and its share side by side, with a bar of that
     share running under both */
  .breakdown-table__measure {
    display: grid;
    /* The value column is never narrower than its text, which is what sizes
       the table column, and stretches to fill the cell beyond that, so the
       bar under it spans the same width in every row and reads as one scale.
       The share is a fixed column, five characters of the values' mono type
       at about 0.6em each, so the values beside it line up down the rows
       whatever their share reads, and the heading sits over them */
    grid-template-columns: minmax(max-content, 1fr) calc(
        var(--global-font-size-s) * 3
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
  /* Skeletons have no baseline; the loaded rows' baselines all sit on their
     first line, which top alignment reproduces */
  th,
  td {
    vertical-align: top;
  }
  /* The pills are right-aligned like the values, and sized in characters of
     the mono type the values are set in, so the columns come out as wide as
     the loaded ones. The headings above them are real text and keep theirs. */
  tbody .breakdown-table__value,
  tbody .breakdown-table__share {
    justify-content: end;
    font-family: var(--global-font-family-mono);
  }
`;

/** What a cell shows for a segment the dimension did not measure. */
const UNMEASURED = "--";

/** Segment names of a few lengths, so the rows read as a list, not a grid */
const SEGMENT_LABEL_SKELETON_WIDTHS = [72, 96, 64, 88];
/**
 * The value pills' width in characters when the dimension's total is not
 * known: a value of five digits, or a cost to the cent.
 */
const DEFAULT_VALUE_SKELETON_CHARS = 6;
/** A share of two digits and a sign, "84%" */
const SHARE_SKELETON_WIDTH = 24;
/** The height of the share bar under each measure */
const SHARE_BAR_HEIGHT = 3;

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
          height={SHARE_BAR_HEIGHT}
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

/**
 * The width of a dimension's value pills. No value is longer than the total
 * it is part of, so the total's length is what the loaded column will need.
 */
function getValueSkeletonWidth(dimension: BreakdownSkeletonDimension) {
  return `${dimension.total?.length ?? DEFAULT_VALUE_SKELETON_CHARS}ch`;
}

/**
 * {@link BreakdownTable} before the segments are known: the real column
 * headings over rows of skeleton swatches, names, values, shares and share
 * bars, laid out on the table's own grid. The loaded table lands on the same
 * columns and row heights; only the number of rows can differ.
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
                    width={getValueSkeletonWidth(dimension)}
                  />
                  <TextSkeleton
                    className="breakdown-table__share"
                    size="S"
                    width={SHARE_SKELETON_WIDTH}
                  />
                  <div className="breakdown-table__bar">
                    <Skeleton
                      height={SHARE_BAR_HEIGHT}
                      borderRadius="var(--global-rounding-full)"
                    />
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
