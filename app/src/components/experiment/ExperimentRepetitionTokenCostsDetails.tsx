import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCostsDetails } from "../trace/TokenCostsDetails";

import { ExperimentRepetitionTokenCostsDetailsQuery } from "./__generated__/ExperimentRepetitionTokenCostsDetailsQuery.graphql";

export function ExperimentRepetitionTokenCostsDetails(props: {
  experimentRepetitionId: string;
}) {
  const data = useLazyLoadQuery<ExperimentRepetitionTokenCostsDetailsQuery>(
    graphql`
      query ExperimentRepetitionTokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ExperimentRepetition {
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
    { nodeId: props.experimentRepetitionId }
  );

  const costData = useMemo(() => {
    if (data.node.__typename === "ExperimentRepetition") {
      const prompt = data.node.costSummary?.prompt?.cost ?? 0;
      const completion = data.node.costSummary?.completion?.cost ?? 0;
      const total = data.node.costSummary?.total?.cost ?? 0;

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
