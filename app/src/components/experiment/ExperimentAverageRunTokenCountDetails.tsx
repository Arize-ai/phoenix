import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCountDetails } from "../trace/TokenCountDetails";

import { ExperimentAverageRunTokenCountDetailsQuery } from "./__generated__/ExperimentAverageRunTokenCountDetailsQuery.graphql";

export function ExperimentAverageRunTokenCountDetails({
  experimentId,
}: {
  experimentId: string;
}) {
  const data = useLazyLoadQuery<ExperimentAverageRunTokenCountDetailsQuery>(
    graphql`
      query ExperimentAverageRunTokenCountDetailsQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            averageRunCostSummary {
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
    { experimentId }
  );

  const tokenData = useMemo(() => {
    if (data.experiment.__typename === "Experiment") {
      const prompt = data.experiment.averageRunCostSummary.prompt.tokens;
      const completion =
        data.experiment.averageRunCostSummary.completion.tokens;
      const total = data.experiment.averageRunCostSummary.total.tokens;

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
  }, [data.experiment]);

  return <TokenCountDetails {...tokenData} label="Average" />;
}
