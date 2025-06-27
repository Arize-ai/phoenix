import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCostsDetails } from "../trace/TokenCostsDetails";

import { ExperimentRunTokenCostsDetailsQuery } from "./__generated__/ExperimentRunTokenCostsDetailsQuery.graphql";

export function ExperimentRunTokenCostsDetails(props: {
  experimentRunId: string;
}) {
  const data = useLazyLoadQuery<ExperimentRunTokenCostsDetailsQuery>(
    graphql`
      query ExperimentRunTokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ExperimentRun {
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
    { nodeId: props.experimentRunId }
  );

  const costData = useMemo(() => {
    if (data.node.__typename === "ExperimentRun") {
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
