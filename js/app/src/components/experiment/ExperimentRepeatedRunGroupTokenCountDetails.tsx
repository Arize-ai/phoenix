import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  getTokenCountDetailsFromCostDetails,
  TokenCountDetails,
} from "../trace/TokenCountDetails";
import type { ExperimentRepeatedRunGroupTokenCountDetailsQuery } from "./__generated__/ExperimentRepeatedRunGroupTokenCountDetailsQuery.graphql";

export function ExperimentRepeatedRunGroupTokenCountDetails(props: {
  experimentRepeatedRunGroupId: string;
}) {
  const data =
    useLazyLoadQuery<ExperimentRepeatedRunGroupTokenCountDetailsQuery>(
      graphql`
        query ExperimentRepeatedRunGroupTokenCountDetailsQuery($nodeId: ID!) {
          node(id: $nodeId) {
            __typename
            ... on ExperimentRepeatedRunGroup {
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
      { nodeId: props.experimentRepeatedRunGroupId }
    );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "ExperimentRepeatedRunGroup") {
      const prompt = data.node.costSummary.prompt.tokens;
      const completion = data.node.costSummary.completion.tokens;
      const total = data.node.costSummary.total.tokens;

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
