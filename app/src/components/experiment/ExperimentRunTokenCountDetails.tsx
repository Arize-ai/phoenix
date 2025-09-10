import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCountDetails } from "../trace/TokenCountDetails";

import { ExperimentRunTokenCountDetailsQuery } from "./__generated__/ExperimentRunTokenCountDetailsQuery.graphql";

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
