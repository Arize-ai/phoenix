export const ONE_HOUR_IN_MINUTES = 60;
export const ONE_DAY_IN_MINUTES = ONE_HOUR_IN_MINUTES * 24;

/**
 * For rolling average, we want to have a minimum evaluation window of 2 days
 * TODO: make this tunable
 */
export const MIN_EVALUATION_WINDOW_IN_MINUTES = 2 * ONE_DAY_IN_MINUTES;
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
      evaluationWindowMinutes: ONE_HOUR_IN_MINUTES,
      samplingIntervalMinutes: ONE_HOUR_IN_MINUTES,
    };
  } else {
    return {
      evaluationWindowMinutes: ONE_DAY_IN_MINUTES,
      samplingIntervalMinutes: ONE_DAY_IN_MINUTES,
    };
  }
}

/**
 * Takes the time range and calculates an evaluation window and sampling interval
 * This maintains a 72 hour evaluation window until the granularity becomes greater than 72 hours
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
      evaluationWindowMinutes: MIN_EVALUATION_WINDOW_IN_MINUTES,
      samplingIntervalMinutes: 1,
    };
  } else if (timeRangeInHours <= 24) {
    return {
      evaluationWindowMinutes: MIN_EVALUATION_WINDOW_IN_MINUTES,
      samplingIntervalMinutes: ONE_HOUR_IN_MINUTES,
    };
  } else {
    return {
      evaluationWindowMinutes: MIN_EVALUATION_WINDOW_IN_MINUTES,
      samplingIntervalMinutes: ONE_DAY_IN_MINUTES,
    };
  }
}
