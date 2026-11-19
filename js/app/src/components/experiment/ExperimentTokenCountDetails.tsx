import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  getTokenCountDetailsFromCostDetails,
  TokenCountDetails,
} from "../trace/TokenCountDetails";
import type { ExperimentTokenCountDetailsQuery } from "./__generated__/ExperimentTokenCountDetailsQuery.graphql";

export function ExperimentTokenCountDetails(props: { experimentId: string }) {
  const data = useLazyLoadQuery<ExperimentTokenCountDetailsQuery>(
    graphql`
      query ExperimentTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Experiment {
            costSummary {
              total {
                tokens
              }
              prompt {
                tokens
              }
              completion {
                tokens
              }
            }
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                tokens
              }
            }
          }
        }
      }
    `,
    { nodeId: props.experimentId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "Experiment") {
      const prompt = data.node.costSummary?.prompt?.tokens ?? 0;
      const completion = data.node.costSummary?.completion?.tokens ?? 0;
      const total = data.node.costSummary?.total?.tokens ?? 0;

      const { promptDetails, completionDetails } =
        getTokenCountDetailsFromCostDetails(data.node.costDetailSummaryEntries);

      return {
        total,
        prompt,
        completion,
        promptDetails,
        completionDetails,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
    };
  }, [data.node]);

  return <TokenCountDetails {...tokenData} />;
}
