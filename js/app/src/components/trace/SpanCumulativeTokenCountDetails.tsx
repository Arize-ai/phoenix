import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { SpanCumulativeTokenCountDetailsQuery } from "./__generated__/SpanCumulativeTokenCountDetailsQuery.graphql";
import { TokenCountDetails } from "./TokenCountDetails";

export function SpanCumulativeTokenCountDetails(props: { spanNodeId: string }) {
  const data = useLazyLoadQuery<SpanCumulativeTokenCountDetailsQuery>(
    graphql`
      query SpanCumulativeTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            cumulativeTokenCountTotal
            cumulativeTokenCountPrompt
            cumulativeTokenCountCompletion
            cumulativeCostDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                tokens
              }
            }
          }
        }
      }
    `,
    { nodeId: props.spanNodeId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "Span") {
      const prompt = data.node.cumulativeTokenCountPrompt ?? 0;
      const completion = data.node.cumulativeTokenCountCompletion ?? 0;
      const total = data.node.cumulativeTokenCountTotal ?? 0;

      // CostBreakdown.tokens includes tokens for which no cost was computed,
      // so the per-token-type breakdown renders even when a model has no
      // pricing configured.
      const promptDetails: Record<string, number> = {};
      const completionDetails: Record<string, number> = {};
      data.node.cumulativeCostDetailSummaryEntries?.forEach((detail) => {
        if (detail.value.tokens == null) {
          return;
        }
        const details = detail.isPrompt ? promptDetails : completionDetails;
        details[detail.tokenType] = detail.value.tokens;
      });

      return {
        total,
        prompt,
        completion,
        promptDetails:
          Object.keys(promptDetails).length > 0 ? promptDetails : undefined,
        completionDetails:
          Object.keys(completionDetails).length > 0
            ? completionDetails
            : undefined,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
    };
  }, [data.node]);

  return <TokenCountDetails {...tokenData} />;
}
