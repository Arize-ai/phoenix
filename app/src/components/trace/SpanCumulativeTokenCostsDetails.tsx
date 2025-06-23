import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { SpanCumulativeTokenCostsDetailsQuery } from "./__generated__/SpanCumulativeTokenCostsDetailsQuery.graphql";
import { TokenCostsDetails } from "./TokenCostsDetails";

export function SpanCumulativeTokenCostsDetails(props: { spanNodeId: string }) {
  const data = useLazyLoadQuery<SpanCumulativeTokenCostsDetailsQuery>(
    graphql`
      query SpanCumulativeTokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            cumulativeCostSummary {
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
                costPerToken
              }
            }
          }
        }
      }
    `,
    { nodeId: props.spanNodeId }
  );

  const costData = useMemo(() => {
    if (data.node.__typename === "Span") {
      const details = data.node.costDetailSummaryEntries;
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

      const total = data.node.cumulativeCostSummary?.total?.cost ?? 0;
      const prompt = data.node.cumulativeCostSummary?.prompt?.cost ?? 0;
      const completion = data.node.cumulativeCostSummary?.completion?.cost ?? 0;

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
  }, [data.node]);

  return <TokenCostsDetails {...costData} />;
}
