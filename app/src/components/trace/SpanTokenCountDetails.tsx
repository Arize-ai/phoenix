import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { SpanTokenCountDetailsQuery } from "./__generated__/SpanTokenCountDetailsQuery.graphql";
import { TokenCountDetails } from "./TokenCountDetails";

export function SpanTokenCountDetails(props: { spanNodeId: string }) {
  const data = useLazyLoadQuery<SpanTokenCountDetailsQuery>(
    graphql`
      query SpanTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            tokenCountTotal
            tokenCountPrompt
            tokenCountCompletion
            tokenPromptDetails {
              audio
              cacheRead
              cacheWrite
            }
          }
        }
      }
    `,
    { nodeId: props.spanNodeId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "Span") {
      const prompt = data.node.tokenCountPrompt ?? 0;
      const completion = data.node.tokenCountCompletion ?? 0;
      const total = data.node.tokenCountTotal ?? 0;
      const promptDetails: Record<string, number> = {};

      // Add available prompt details
      if (data.node.tokenPromptDetails?.audio) {
        promptDetails.audio = data.node.tokenPromptDetails.audio;
      }
      if (data.node.tokenPromptDetails?.cacheRead) {
        promptDetails["cache read"] = data.node.tokenPromptDetails.cacheRead;
      }
      if (data.node.tokenPromptDetails?.cacheWrite) {
        promptDetails["cache write"] = data.node.tokenPromptDetails.cacheWrite;
      }

      return {
        total,
        prompt,
        completion,
        promptDetails:
          Object.keys(promptDetails).length > 0 ? promptDetails : undefined,
      };
    }

    return {
      total: 0,
      prompt: 0,
      completion: 0,
    };
  }, [data.node]);

  return <TokenCountDetails {...tokenData} />;
}
