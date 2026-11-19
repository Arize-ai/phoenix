import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { TraceTokenCountDetailsQuery } from "./__generated__/TraceTokenCountDetailsQuery.graphql";
import {
  getTokenCountDetailsFromCostDetails,
  TokenCountDetails,
} from "./TokenCountDetails";

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

      const { promptDetails, completionDetails } =
        getTokenCountDetailsFromCostDetails(data.node.costDetailSummaryEntries);

      return {
        total: tracePrompt + traceCompletion,
        prompt: tracePrompt,
        completion: traceCompletion,
        promptDetails,
        completionDetails,
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
