/**
 * One part of a whole, shared by every dimension the whole is measured in.
 * A token type is a segment: it has a count of tokens and a cost, and keeps
 * one color across both.
 */
export type BreakdownSegment = {
  /** Stable identity that keys the segment's value in each dimension. */
  key: string;
  /** What the legend calls the segment. */
  label: string;
  /** A CSS color; the same in every bar and cell that draws the segment. */
  color: string;
};

/**
 * One way of measuring the whole, e.g. tokens or cost. Each dimension draws
 * its own bar and its own table columns from the same segments.
 */
export type BreakdownDimension = {
  /** Stable identity, e.g. "tokens". */
  key: string;
  /** Column and bar heading, e.g. "Tokens". */
  label: string;
  /** The whole the segments are drawn against. */
  total: number;
  /**
   * The value of each segment by segment key. A segment with no entry was not
   * measured in this dimension and is shown as such rather than as zero.
   */
  values: Partial<Record<string, number>>;
  /** Renders a value in this dimension's unit. */
  formatter: (value: number) => string;
  /**
   * Values at which to draw a tick under the bar, e.g. where the input
   * segments end and the output segments begin.
   */
  markerValues?: number[];
};

/**
 * What a skeleton knows of a dimension before its values load: its identity,
 * its label and, when the caller already has it, its formatted total.
 */
export type BreakdownSkeletonDimension = Pick<
  BreakdownDimension,
  "key" | "label"
> & {
  /** The total, already formatted. Omit to draw a placeholder in its place. */
  total?: string;
};
