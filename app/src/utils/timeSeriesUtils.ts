/**
 * Takes a time range and calculates an appropriate evaluation window and sampling interval
 * Does not take into account smoothening. This is best used for timeseries for non drift metrics
 * @param timeRange
 */
export function calculateGranularity(timeRange: TimeRange): {
  evaluationWindowMinutes: number;
  samplingIntervalMinutes: number;
} {
  const { start, end } = timeRange;
  const timeRangeInHours = Math.floor(
    (end.valueOf() - start.valueOf()) / 1000 / 60 / 60
  );
  if (timeRangeInHours <= 1) {
    return {
      evaluationWindowMinutes: 1,
      samplingIntervalMinutes: 1,
    };
  } else if (timeRangeInHours <= 24) {
    return {
      evaluationWindowMinutes: 60,
      samplingIntervalMinutes: 60,
    };
  } else {
    return {
      evaluationWindowMinutes: 60 * 24,
      samplingIntervalMinutes: 60 * 24,
    };
  }
}

/**
 * Takes the time range and calculates an evaluation window and sampling interval
 * This maintains a 72hour evaluation window until the granularity becomes greater than 72 hours
 * @param timeRange
 */
export function calculateGranularityWithRollingAverage(timeRange: TimeRange): {
  evaluationWindowMinutes: number;
  samplingIntervalMinutes: number;
} {
  const { start, end } = timeRange;
  const timeRangeInHours = Math.floor(
    (end.valueOf() - start.valueOf()) / 1000 / 60 / 60
  );
  if (timeRangeInHours <= 1) {
    return {
      evaluationWindowMinutes: 72 * 60,
      samplingIntervalMinutes: 1,
    };
  } else if (timeRangeInHours <= 24) {
    return {
      evaluationWindowMinutes: 72 * 60,
      samplingIntervalMinutes: 60,
    };
  } else {
    return {
      evaluationWindowMinutes: 72 * 60,
      samplingIntervalMinutes: 60 * 24,
    };
  }
}
