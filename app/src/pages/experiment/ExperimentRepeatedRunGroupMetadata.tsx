import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import { ExperimentRepeatedRunGroupTokenCosts } from "@phoenix/components/experiment/ExperimentRepeatedRunGroupTokenCosts";
import { ExperimentRepeatedRunGroupTokenCount } from "@phoenix/components/experiment/ExperimentRepeatedRunGroupTokenCount";
import { LatencyText } from "@phoenix/components/trace/LatencyText";

import type { ExperimentRepeatedRunGroupMetadataFragment$key } from "./__generated__/ExperimentRepeatedRunGroupMetadataFragment.graphql";

export function ExperimentRepeatedRunGroupMetadata(props: {
  fragmentRef: ExperimentRepeatedRunGroupMetadataFragment$key;
}) {
  const data = useFragment(
    graphql`
      fragment ExperimentRepeatedRunGroupMetadataFragment on ExperimentRepeatedRunGroup {
        id
        averageLatencyMs
        costSummary {
          total {
            tokens
            cost
          }
        }
      }
    `,
    props.fragmentRef
  );
  const { id, averageLatencyMs, costSummary } = data;
  const tokenCountTotal = costSummary.total.tokens;
  const costTotal = costSummary.total.cost;
  return (
    <Flex direction="row" gap="size-100">
      {averageLatencyMs != null && (
        <LatencyText size="S" latencyMs={averageLatencyMs} />
      )}
      {
        <ExperimentRepeatedRunGroupTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRepeatedRunGroupId={id}
          size="S"
        />
      }
      {costTotal != null && id ? (
        <ExperimentRepeatedRunGroupTokenCosts
          costTotal={costTotal}
          experimentRepeatedRunGroupId={id}
          size="S"
        />
      ) : null}
    </Flex>
  );
}
