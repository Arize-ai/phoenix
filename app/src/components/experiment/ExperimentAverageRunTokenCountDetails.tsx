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
            runCount
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
    { experimentId }
  );

  const tokenData = useMemo(() => {
    if (data.experiment.__typename === "Experiment") {
      const tokenCountPrompt = data.experiment.costSummary.prompt.tokens;
      const tokenCountCompletion =
        data.experiment.costSummary.completion.tokens;
      const tokenCountTotal = data.experiment.costSummary.total.tokens;
      const runCount = data.experiment.runCount;
      const averageRunTokenCountTotal =
        tokenCountTotal == null || runCount == 0
          ? null
          : tokenCountTotal / runCount;
      const averageRunTokenCountPrompt =
        tokenCountPrompt == null || runCount == 0
          ? null
          : tokenCountPrompt / runCount;
      const averageRunTokenCountCompletion =
        tokenCountCompletion == null || runCount == 0
          ? null
          : tokenCountCompletion / runCount;

      return {
        total: averageRunTokenCountTotal,
        prompt: averageRunTokenCountPrompt,
        completion: averageRunTokenCountCompletion,
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
