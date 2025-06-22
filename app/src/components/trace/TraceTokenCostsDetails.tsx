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

      const total = data.node.costSummary?.total?.cost ?? 0;
      const prompt = data.node.costSummary?.prompt?.cost ?? 0;
      const completion = data.node.costSummary?.completion?.cost ?? 0;

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
