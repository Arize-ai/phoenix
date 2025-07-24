import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";

import type { ExperimentTokenCostDetailsQuery } from "./__generated__/ExperimentTokenCostDetailsQuery.graphql";

export function ExperimentTokenCostDetails({
  experimentId,
}: {
  experimentId: string;
}) {
  const data = useLazyLoadQuery<ExperimentTokenCostDetailsQuery>(
    graphql`
      query ExperimentTokenCostDetailsQuery($experimentId: ID!) {
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

      const total = data.experiment.costSummary?.total?.cost ?? 0;
      const prompt = data.experiment.costSummary?.prompt?.cost ?? 0;
      const completion = data.experiment.costSummary?.completion?.cost ?? 0;

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
