import { Flex } from "@phoenix/components";
import {
  ExperimentRunTokenCosts,
  ExperimentRunTokenCount,
} from "@phoenix/components/experiment";
import { TokenCount } from "@phoenix/components/trace";

import { ExperimentRunLatency } from "./ExperimentRunLatency";

type ExperimentRunMetadataProps = {
  id: string;
  latencyMs: number | null;
  costSummary: {
    total: {
      tokens: number | null;
      cost: number | null;
    };
  };
};

export function ExperimentRunMetadata(props: ExperimentRunMetadataProps) {
  const { id, latencyMs, costSummary } = props;
  const tokenCountTotal = costSummary.total.tokens;
  const costTotal = costSummary.total.cost;
  return (
    <Flex direction="row" gap="size-100">
      <ExperimentRunLatency latencyMs={latencyMs} />
      {tokenCountTotal != null && id ? (
        <ExperimentRunTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRunId={id}
          size="S"
        />
      ) : (
        <TokenCount size="S">{tokenCountTotal}</TokenCount>
      )}
      {costTotal != null && id ? (
        <ExperimentRunTokenCosts
          costTotal={costTotal}
          experimentRunId={id}
          size="S"
        />
      ) : null}
    </Flex>
  );
}
