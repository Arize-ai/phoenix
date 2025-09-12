import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCostsDetails } from "../trace/TokenCostsDetails";

import { ExperimentRepeatedRunGroupTokenCostDetailsQuery } from "./__generated__/ExperimentRepeatedRunGroupTokenCostDetailsQuery.graphql";

export function ExperimentRepeatedRunGroupTokenCostDetails(props: {
  experimentRepeatedRunGroupId: string;
}) {
  const data =
    useLazyLoadQuery<ExperimentRepeatedRunGroupTokenCostDetailsQuery>(
      graphql`
        query ExperimentRepeatedRunGroupTokenCostDetailsQuery($nodeId: ID!) {
          node(id: $nodeId) {
            __typename
            ... on ExperimentRepeatedRunGroup {
              costSummary {
                total {
                  cost
                }
                prompt {
                  cost
                }
                completion {
                  cost
                }
              }
            }
          }
        }
      `,
      { nodeId: props.experimentRepeatedRunGroupId }
    );

  const costData = useMemo(() => {
    if (data.node.__typename === "ExperimentRepeatedRunGroup") {
      const prompt = data.node.costSummary.prompt.cost;
      const completion = data.node.costSummary.completion.cost;
      const total = data.node.costSummary.total.cost;

      return {
        total,
        prompt,
        completion,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
    };
  }, [data.node]);

  return <TokenCostsDetails {...costData} />;
}
