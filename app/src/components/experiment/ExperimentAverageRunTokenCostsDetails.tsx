import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";

import type { ExperimentAverageRunTokenCostsDetailsQuery } from "./__generated__/ExperimentAverageRunTokenCostsDetailsQuery.graphql";

export function ExperimentAverageRunTokenCostsDetails({
  experimentId,
}: {
  experimentId: string;
}) {
  const data = useLazyLoadQuery<ExperimentAverageRunTokenCostsDetailsQuery>(
    graphql`
      query ExperimentAverageRunTokenCostsDetailsQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            averageRunCostSummary {
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
            averageRunCostDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
              }
            }
          }
        }
      }
    `,
    { experimentId }
  );

  const costData = useMemo(() => {
    if (data.experiment.__typename === "Experiment") {
      const details = data.experiment.averageRunCostDetailSummaryEntries;
      if (!details) {
        return {
          total: null,
          prompt: null,
          completion: null,
          promptDetails: null,
          completionDetails: null,
        };
      }

      const promptEntries = details.filter((detail) => detail.isPrompt);
      const completionEntries = details.filter((detail) => !detail.isPrompt);

      const total = data.experiment.averageRunCostSummary.total.cost;
      const prompt = data.experiment.averageRunCostSummary.prompt.cost;
      const completion = data.experiment.averageRunCostSummary.completion.cost;

      const promptDetails: Record<string, number> = {};
      promptEntries.forEach((detail) => {
        if (detail.value.cost != null) {
          promptDetails[detail.tokenType] = detail.value.cost;
        }
      });

      const completionDetails: Record<string, number> = {};
      completionEntries.forEach((detail) => {
        if (detail.value.cost != null) {
          completionDetails[detail.tokenType] = detail.value.cost;
        }
      });

      return {
        total,
        prompt,
        completion,
        promptDetails:
          Object.keys(promptDetails).length > 0 ? promptDetails : null,
        completionDetails:
          Object.keys(completionDetails).length > 0 ? completionDetails : null,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
      promptDetails: null,
      completionDetails: null,
    };
  }, [data.experiment]);

  return <TokenCostsDetails {...costData} />;
}
