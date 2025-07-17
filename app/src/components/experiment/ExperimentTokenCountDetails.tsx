import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCountDetails } from "../trace/TokenCountDetails";

import { ExperimentTokenCountDetailsQuery } from "./__generated__/ExperimentTokenCountDetailsQuery.graphql";

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
