import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCountDetails } from "../trace/TokenCountDetails";

import { ExperimentRepetitionTokenCountDetailsQuery } from "./__generated__/ExperimentRepetitionTokenCountDetailsQuery.graphql";

export function ExperimentRepetitionTokenCountDetails(props: {
  experimentRepetitionId: string;
}) {
  const data = useLazyLoadQuery<ExperimentRepetitionTokenCountDetailsQuery>(
    graphql`
      query ExperimentRepetitionTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ExperimentRepetition {
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
    { nodeId: props.experimentRepetitionId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "ExperimentRepetition") {
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
