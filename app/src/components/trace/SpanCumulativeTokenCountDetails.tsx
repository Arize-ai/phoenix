import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { SpanCumulativeTokenCountDetailsQuery } from "./__generated__/SpanCumulativeTokenCountDetailsQuery.graphql";
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
      return {
        total,
        prompt,
        completion,
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
