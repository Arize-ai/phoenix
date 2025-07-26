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
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
              }
            }
            runCount
          }
        }
      }
    `,
    { experimentId }
  );

  const costData = useMemo(() => {
    if (data.experiment.__typename === "Experiment") {
      const details = data.experiment.costDetailSummaryEntries;
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

      const costTotal = data.experiment.costSummary.total.cost;
      const costPrompt = data.experiment.costSummary.prompt.cost;
      const costCompletion = data.experiment.costSummary.completion.cost;
      const runCount = data.experiment.runCount;
      const averageRunCostTotal =
        costTotal == null || runCount == 0 ? null : costTotal / runCount;
      const averageRunCostPrompt =
        costPrompt == null || runCount == 0 ? null : costPrompt / runCount;
      const averageRunCostCompletion =
        costCompletion == null || runCount == 0
          ? null
          : costCompletion / runCount;

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
        total: averageRunCostTotal,
        prompt: averageRunCostPrompt,
        completion: averageRunCostCompletion,
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

  return <TokenCostsDetails {...costData} label="Average" />;
}
