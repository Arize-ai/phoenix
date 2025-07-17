import CronExpressionParser from "cron-parser";
import cronstrue from "cronstrue";
/**
 * Creates a summary text for a retention policy's deletion rule.
 * @param numberOfDays - The number of days after which traces will be deleted.
 * @param numberOfTraces - The maximum number of traces that will be deleted.
 * @returns A string describing the deletion rule.
 */
export const createPolicyDeletionSummaryText = ({
  numberOfDays,
  numberOfTraces,
}: {
  numberOfDays?: number;
  numberOfTraces?: number;
}) => {
  if (numberOfDays === 0 && !numberOfTraces) {
    return "This policy will not delete any traces.";
  }
  const daysPolicyString =
    typeof numberOfDays === "number" ? `older than ${numberOfDays} days` : "";
  const tracesPolicyString =
    typeof numberOfTraces === "number"
      ? `when there are more than ${numberOfTraces} traces`
      : "";

  const policyString =
    daysPolicyString && tracesPolicyString
      ? `${daysPolicyString} or ${tracesPolicyString}`
      : daysPolicyString || tracesPolicyString;
  return `This policy will delete traces ${policyString}`;
};
/**
 * Creates a summary text for a retention policy's enforcement schedule.
 * @param schedule - The cron expression for the enforcement schedule.
 * @returns A string describing the enforcement schedule.
 */
export const createPolicyScheduleSummaryText = ({
  schedule,
}: {
  schedule: string;
}): string => {
  let scheduleString = "unknown";
  try {
    CronExpressionParser.parse(schedule);
  } catch (error) {
    return "invalid schedule";
  }
  try {
    scheduleString = cronstrue.toString(schedule);
  } catch (error) {
    return "invalid schedule";
  }
  return `${scheduleString} (UTC)`;
};
