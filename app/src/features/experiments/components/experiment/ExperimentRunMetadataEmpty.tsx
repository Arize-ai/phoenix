import { Flex } from "@phoenix/components";
import { TokenCosts, TokenCount } from "@phoenix/features/trace/components";
import { LatencyText } from "@phoenix/features/trace/components/LatencyText";

export function ExperimentRunMetadataEmpty() {
  return (
    <Flex direction="row" gap="size-100">
      <LatencyText size="S" latencyMs={null} />
      <TokenCount size="S">{null}</TokenCount>
      <TokenCosts size="S">{null}</TokenCosts>
    </Flex>
  );
}
