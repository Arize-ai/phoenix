import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Loading, Text, TextProps } from "@phoenix/components";

import type { Cost_CostDetailsQuery } from "./__generated__/Cost_CostDetailsQuery.graphql";

type CostProps = {
  /**
   * The total cost of the node (span, trace, session, etc.)
   */
  totalCost: number;
  /**
   * The size of the icon and text
   */
  nodeId: string;
  /**
   * The id of the node (span, trace, session, etc.)
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of the node (span, trace, session, etc.)
 */
export function Cost(props: CostProps) {
  return (
    <TooltipTrigger delay={500}>
      <TriggerWrap>
        <CostItem size={props.size}>{props.totalCost}</CostItem>
      </TriggerWrap>
      <Tooltip>
        <Suspense fallback={<Loading />}>
          <CostDetails nodeId={props.nodeId} />
        </Suspense>
      </Tooltip>
    </TooltipTrigger>
  );
}

function CostDetails(props: { nodeId: string }) {
  const data = useLazyLoadQuery<Cost_CostDetailsQuery>(
    graphql`
      query Cost_CostDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            cost {
              inputTokenCost
              outputTokenCost
              cacheReadTokenCost
              cacheWriteTokenCost
              promptAudioTokenCost
              completionAudioTokenCost
            }
          }
        }
      }
    `,
    { nodeId: props.nodeId }
  );

  const {
    tokenCostInput,
    tokenCostOutput,
    tokenCostCacheRead,
    tokenCostCacheWrite,
    tokenCostPromptAudio,
    tokenCostCompletionAudio,
  } = useMemo(() => {
    switch (data.node.__typename) {
      case "Span":
        return {
          tokenCostInput: data.node.cost?.inputTokenCost,
          tokenCostOutput: data.node.cost?.outputTokenCost,
          tokenCostCacheRead: data.node.cost?.cacheReadTokenCost,
          tokenCostCacheWrite: data.node.cost?.cacheWriteTokenCost,
          tokenCostPromptAudio: data.node.cost?.promptAudioTokenCost,
          tokenCostCompletionAudio: data.node.cost?.completionAudioTokenCost,
        };
      default:
        return {
          tokenCostInput: undefined,
          tokenCostOutput: undefined,
          tokenCostCacheRead: undefined,
          tokenCostCacheWrite: undefined,
          tokenCostPromptAudio: undefined,
          tokenCostCompletionAudio: undefined,
        };
    }
  }, [data.node]);

  return (
    <Flex direction="column" gap="size-50">
      {tokenCostInput != null && tokenCostInput !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>input tokens</Text>
          <CostItem>{tokenCostInput}</CostItem>
        </Flex>
      )}
      {tokenCostOutput != null && tokenCostOutput !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>output tokens</Text>
          <CostItem>{tokenCostOutput}</CostItem>
        </Flex>
      )}
      {tokenCostPromptAudio != null && tokenCostPromptAudio !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>prompt audio tokens</Text>
          <CostItem>{tokenCostPromptAudio}</CostItem>
        </Flex>
      )}
      {tokenCostCompletionAudio != null && tokenCostCompletionAudio !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>completion audio tokens</Text>
          <CostItem>{tokenCostCompletionAudio}</CostItem>
        </Flex>
      )}
      {tokenCostCacheRead != null && tokenCostCacheRead !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>cache read tokens</Text>
          <CostItem>{tokenCostCacheRead}</CostItem>
        </Flex>
      )}
      {tokenCostCacheWrite != null && tokenCostCacheWrite !== 0 && (
        <Flex direction="row" gap="size-100" justifyContent="space-between">
          <Text>cache write tokens</Text>
          <CostItem>{tokenCostCacheWrite}</CostItem>
        </Flex>
      )}
    </Flex>
  );
}

function CostItem({
  children,
  ...textProps
}: {
  children: number;
  size?: TextProps["size"];
}) {
  return <Text {...textProps}>{`$${Number(children.toPrecision(3))}`}</Text>;
}
