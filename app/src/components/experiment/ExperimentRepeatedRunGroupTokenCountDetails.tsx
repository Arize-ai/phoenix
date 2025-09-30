import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCountDetails } from "../trace/TokenCountDetails";

import { ExperimentRepeatedRunGroupTokenCountDetailsQuery } from "./__generated__/ExperimentRepeatedRunGroupTokenCountDetailsQuery.graphql";

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

  return <TokenCountDetails {...tokenData} />;
}
