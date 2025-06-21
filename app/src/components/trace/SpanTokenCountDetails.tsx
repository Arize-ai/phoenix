import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "@phoenix/components";

import { SpanTokenCountDetailsQuery } from "./__generated__/SpanTokenCountDetailsQuery.graphql";
import { TokenCount } from "./TokenCount";

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

  const {
    tokenCountPrompt,
    tokenCountCompletion,
    tokenCountCacheRead,
    tokenCountCacheWrite,
    tokenCountAudio,
  } = useMemo(() => {
    switch (data.node.__typename) {
      case "Span":
        return {
          tokenCountPrompt: data.node.tokenCountPrompt ?? 0,
          tokenCountCompletion: data.node.tokenCountCompletion ?? 0,
          tokenCountCacheRead: data.node.tokenPromptDetails?.cacheRead,
          tokenCountCacheWrite: data.node.tokenPromptDetails?.cacheWrite,
          tokenCountAudio: data.node.tokenPromptDetails?.audio,
        };
      case "ProjectSession":
        return {
          tokenCountPrompt: data.node.tokenUsage.prompt,
          tokenCountCompletion: data.node.tokenUsage.completion,
        };
      case "Trace":
        return {
          tokenCountPrompt: data.node.rootSpan?.cumulativeTokenCountPrompt ?? 0,
          tokenCountCompletion:
            data.node.rootSpan?.cumulativeTokenCountCompletion ?? 0,
        };
      default:
        return {
          tokenCountPrompt: 0,
          tokenCountCompletion: 0,
        };
    }
  }, [data.node]);

  return (
    <Flex direction="column" gap="size-50">
      <Flex direction="row" gap="size-100" justifyContent="space-between">
        <Text>prompt tokens</Text>
        <TokenCount>{tokenCountPrompt}</TokenCount>
      </Flex>
      <Flex direction="row" gap="size-100" justifyContent="space-between">
        <Text>completion tokens</Text>
        <TokenCount>{tokenCountCompletion}</TokenCount>
      </Flex>
      {tokenCountAudio != null && tokenCountAudio !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>audio tokens</Text>
          <TokenCount>{tokenCountAudio}</TokenCount>
        </Flex>
      )}
      {tokenCountCacheRead != null && tokenCountCacheRead !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>cache read tokens</Text>
          <TokenCount>{tokenCountCacheRead}</TokenCount>
        </Flex>
      )}
      {tokenCountCacheWrite != null && tokenCountCacheWrite !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>cache write tokens</Text>
          <TokenCount>{tokenCountCacheWrite}</TokenCount>
        </Flex>
      )}
    </Flex>
  );
}
