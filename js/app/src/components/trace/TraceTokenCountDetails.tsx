import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { TraceTokenCountDetailsQuery } from "./__generated__/TraceTokenCountDetailsQuery.graphql";
import { TokenCountDetails } from "./TokenCountDetails";

export function TraceTokenCountDetails(props: { traceNodeId: string }) {
  const data = useLazyLoadQuery<TraceTokenCountDetailsQuery>(
    graphql`
      query TraceTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Trace {
            rootSpan {
              cumulativeTokenCountPrompt
              cumulativeTokenCountCompletion
            }
            costDetailSummaryEntries {
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
    { nodeId: props.traceNodeId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "Trace") {
      const tracePrompt = data.node.rootSpan?.cumulativeTokenCountPrompt ?? 0;
      const traceCompletion =
        data.node.rootSpan?.cumulativeTokenCountCompletion ?? 0;

      // CostBreakdown.tokens includes tokens for which no cost was computed,
      // so the per-token-type breakdown renders even when a model has no
      // pricing configured.
      const promptDetails: Record<string, number> = {};
      const completionDetails: Record<string, number> = {};
      data.node.costDetailSummaryEntries?.forEach((detail) => {
        if (detail.value.tokens == null) {
          return;
        }
        const details = detail.isPrompt ? promptDetails : completionDetails;
        details[detail.tokenType] = detail.value.tokens;
      });

      return {
        total: tracePrompt + traceCompletion,
        prompt: tracePrompt,
        completion: traceCompletion,
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
