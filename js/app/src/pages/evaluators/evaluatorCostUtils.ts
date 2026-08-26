import { getTimeRangeFromLastNTimeRangeKey } from "@phoenix/components/datetime/utils";

export function getEvaluatorCostTimeRange(now = Date.now()) {
  const { start } = getTimeRangeFromLastNTimeRangeKey("7d", now);
  if (start == null) {
    throw new Error("Last-seven-days time range must have a start");
  }
  return { start: start.toISOString() };
}
