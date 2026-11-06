import { ColorSwatch, Flex, Text, Truncate } from "@phoenix/components";
import { BaselineExperimentBadge } from "@phoenix/components/experiment";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";

import type { ExperimentReferenceLabel } from "./ExperimentBaselineReference";

/**
 * Shared tooltip header for experiment metric charts: the experiment's
 * sequence number token followed by its name, led by a swatch in the
 * experiment's color when it has one.
 */
export function ExperimentMetricsTooltipHeader({
  sequenceNumber,
  name,
  isBaseline = false,
  color,
  referenceLabel = "baseline",
}: {
  sequenceNumber: number;
  name?: string;
  isBaseline?: boolean;
  color?: string;
  referenceLabel?: ExperimentReferenceLabel;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-100" maxWidth="100%">
      {color != null && <ColorSwatch color={color} shape="circle" />}
      <SequenceNumberToken sequenceNumber={sequenceNumber} />
      {name != null && (
        <Text weight="heavy" size="S" minWidth={0}>
          <Truncate maxWidth="100%" title={name}>
            {name}
          </Truncate>
        </Text>
      )}
      {isBaseline ? <BaselineExperimentBadge label={referenceLabel} /> : null}
    </Flex>
  );
}
