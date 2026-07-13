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
