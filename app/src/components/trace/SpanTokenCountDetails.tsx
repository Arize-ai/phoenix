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
            tokenCountPrompt
            tokenCountCompletion
            tokenPromptDetails {
              audio
              cacheRead
              cacheWrite
            }
          }
          ... on ProjectSession {
            tokenUsage {
              prompt
              completion
            }
          }
          ... on Trace {
            rootSpan {
              cumulativeTokenCountPrompt
              cumulativeTokenCountCompletion
            }
          }
        }
      }
    `,
    { nodeId: props.spanNodeId }
  );

  const tokenData = useMemo(() => {
    switch (data.node.__typename) {
      case "Span": {
        const prompt = data.node.tokenCountPrompt ?? 0;
        const completion = data.node.tokenCountCompletion ?? 0;
        const promptDetails: Record<string, number> = {};

        // Add available prompt details
        if (data.node.tokenPromptDetails?.audio) {
          promptDetails.audio = data.node.tokenPromptDetails.audio;
        }
        if (data.node.tokenPromptDetails?.cacheRead) {
          promptDetails["cache read"] = data.node.tokenPromptDetails.cacheRead;
        }
        if (data.node.tokenPromptDetails?.cacheWrite) {
          promptDetails["cache write"] =
            data.node.tokenPromptDetails.cacheWrite;
        }

        return {
          total: prompt + completion,
          prompt,
          completion,
          promptDetails:
            Object.keys(promptDetails).length > 0 ? promptDetails : undefined,
        };
      }
      case "ProjectSession": {
        const sessionPrompt = data.node.tokenUsage.prompt;
        const sessionCompletion = data.node.tokenUsage.completion;
        return {
          total: sessionPrompt + sessionCompletion,
          prompt: sessionPrompt,
          completion: sessionCompletion,
        };
      }
      case "Trace": {
        const tracePrompt = data.node.rootSpan?.cumulativeTokenCountPrompt ?? 0;
        const traceCompletion =
          data.node.rootSpan?.cumulativeTokenCountCompletion ?? 0;
        return {
          total: tracePrompt + traceCompletion,
          prompt: tracePrompt,
          completion: traceCompletion,
        };
      }
      default:
        return {
          total: 0,
          prompt: 0,
          completion: 0,
        };
    }
  }, [data.node]);

  return <TokenCountDetails {...tokenData} />;
}
