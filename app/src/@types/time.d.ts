declare type TimeRange = {
  start: Date;
  end: Date;
};

/**
 * A time range that is open-ended on either the start or end.
 */
declare type OpenTimeRange = {
  start?: Date | null;
  end?: Date | null;
};

/**
 * The way in which to bin a time range. Should be kept in sync with GraphQL API
 */
declare type TimeBinScale =
  | "MINUTE"
  | "HOUR"
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "YEAR";
