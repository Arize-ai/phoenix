import { Flex, Text } from "@phoenix/components";
import { BaselineExperimentBadge } from "@phoenix/components/experiment";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";

/**
 * Shared tooltip header for experiment metric charts: the experiment's
 * sequence number token followed by its name.
 */
export function ExperimentMetricsTooltipHeader({
  sequenceNumber,
  name,
  isBaseline = false,
}: {
  sequenceNumber: number;
  name?: string;
  isBaseline?: boolean;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      <SequenceNumberToken sequenceNumber={sequenceNumber} />
      {name != null && (
        <Text weight="heavy" size="S">
          {name}
        </Text>
      )}
      {isBaseline ? <BaselineExperimentBadge /> : null}
    </Flex>
  );
}

/**
 * Safely extracts the experiment fields from a recharts tooltip payload datum.
 */
export function parseExperimentDatum(value: unknown): {
  experimentName?: string;
  isBaseline?: boolean;
} {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const datum: { experimentName?: string; isBaseline?: boolean } = {};
  if ("experimentName" in value && typeof value.experimentName === "string") {
    datum.experimentName = value.experimentName;
  }
  if ("isBaseline" in value && typeof value.isBaseline === "boolean") {
    datum.isBaseline = value.isBaseline;
  }
  return datum;
}
