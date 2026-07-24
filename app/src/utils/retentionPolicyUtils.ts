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
    numberOfDays != null && !isNaN(numberOfDays)
      ? `older than ${numberOfDays} days`
      : "";
  const tracesPolicyString =
    numberOfTraces != null && !isNaN(numberOfTraces)
      ? `when there are more than ${numberOfTraces} traces`
      : "";

  const policyString =
    daysPolicyString && tracesPolicyString
      ? `${daysPolicyString} or ${tracesPolicyString}`
      : daysPolicyString || tracesPolicyString;

  if (policyString === "") {
    return "Enter a number of days or a number of traces, or both, to configure this policy.";
  }
  return `This policy will delete traces ${policyString}`;
};
/**
 * Creates a summary text for a retention policy's rule.
 * @param rule - The retention rule with a GraphQL __typename discriminator.
 * @returns A string describing the rule.
 */
export const createPolicyRuleSummaryText = (rule: {
  readonly __typename: string;
  readonly maxDays?: number;
  readonly maxCount?: number;
}): string => {
  switch (rule.__typename) {
    case "TraceRetentionRuleMaxCount":
      return `${rule.maxCount} traces`;
    case "TraceRetentionRuleMaxDays":
      return rule.maxDays === 0 ? "Infinite" : `${rule.maxDays} days`;
    case "TraceRetentionRuleMaxDaysOrCount":
      return `${rule.maxDays} days or ${rule.maxCount} traces`;
    default:
      return "Unknown";
  }
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
  } catch {
    return "invalid schedule";
  }
  try {
    scheduleString = cronstrue.toString(schedule);
  } catch {
    return "invalid schedule";
  }
  return `${scheduleString} (UTC)`;
};
