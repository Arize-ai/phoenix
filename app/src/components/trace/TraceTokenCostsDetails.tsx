import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { TraceTokenCostsDetailsQuery } from "./__generated__/TraceTokenCostsDetailsQuery.graphql";
import { TokenCostsDetails } from "./TokenCostsDetails";

export function TraceTokenCostsDetails(props: { traceNodeId: string }) {
  const data = useLazyLoadQuery<TraceTokenCostsDetailsQuery>(
    graphql`
      query TraceTokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Trace {
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
    { nodeId: props.traceNodeId }
  );

  const costData = useMemo(() => {
    if (data.node.__typename === "Trace") {
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

      const promptTotal = promptEntries.reduce(
        (sum, detail) => sum + (detail.value.cost || 0),
        0
      );
      const completionTotal = completionEntries.reduce(
        (sum, detail) => sum + (detail.value.cost || 0),
        0
      );

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
        total: promptTotal + completionTotal,
        prompt: promptTotal > 0 ? promptTotal : null,
        completion: completionTotal > 0 ? completionTotal : null,
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
