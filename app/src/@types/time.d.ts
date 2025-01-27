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
