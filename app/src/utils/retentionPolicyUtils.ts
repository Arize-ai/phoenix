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
