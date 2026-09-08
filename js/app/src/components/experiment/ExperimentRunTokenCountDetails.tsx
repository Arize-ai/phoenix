import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  getTokenCountDetailsFromCostDetails,
  TokenCountDetails,
} from "../trace/TokenCountDetails";
import type { ExperimentRunTokenCountDetailsQuery } from "./__generated__/ExperimentRunTokenCountDetailsQuery.graphql";

export function ExperimentRunTokenCountDetails(props: {
  experimentRunId: string;
}) {
  const data = useLazyLoadQuery<ExperimentRunTokenCountDetailsQuery>(
    graphql`
      query ExperimentRunTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ExperimentRun {
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
    { nodeId: props.experimentRunId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "ExperimentRun") {
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
