import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Loading, Text, TextProps } from "@phoenix/components";

import type { TokenCosts_TokenCostsDetailsQuery } from "./__generated__/TokenCosts_TokenCostsDetailsQuery.graphql";

type TokenCostsProps = {
  /**
   * The total cost of the node (span, trace, session, etc.)
   */
  totalCost: number;
  /**
   * The id of the node (span, trace, session, etc.)
   */
  nodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of the node (span, trace, session, etc.)
 */
export function TokenCosts(props: TokenCostsProps) {
  return (
    <TooltipTrigger delay={500}>
      <TriggerWrap>
        <TokenCostsItem size={props.size}>{props.totalCost}</TokenCostsItem>
      </TriggerWrap>
      <Tooltip>
        <Suspense fallback={<Loading />}>
          <TokenCostsDetails nodeId={props.nodeId} />
        </Suspense>
      </Tooltip>
    </TooltipTrigger>
  );
}

function TokenCostsDetails(props: { nodeId: string }) {
  const data = useLazyLoadQuery<TokenCosts_TokenCostsDetailsQuery>(
    graphql`
      query TokenCosts_TokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            cost {
              input
              output
              cacheRead
              cacheWrite
              promptAudio
              completionAudio
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
          tokenCostInput: data.node.cost?.input,
          tokenCostOutput: data.node.cost?.output,
          tokenCostCacheRead: data.node.cost?.cacheRead,
          tokenCostCacheWrite: data.node.cost?.cacheWrite,
          tokenCostPromptAudio: data.node.cost?.promptAudio,
          tokenCostCompletionAudio: data.node.cost?.completionAudio,
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
      {!tokenCostInput &&
      !tokenCostOutput &&
      !tokenCostCacheRead &&
      !tokenCostCacheWrite &&
      !tokenCostPromptAudio &&
      !tokenCostCompletionAudio ? (
        <Text>No cost details</Text>
      ) : (
        <>
          {tokenCostInput != null && tokenCostInput !== 0 && (
            <Flex direction="row" gap="size-100" justifyContent="space-between">
              <Text>input tokens</Text>
              <TokenCostsItem>{tokenCostInput}</TokenCostsItem>
            </Flex>
          )}
          {tokenCostOutput != null && tokenCostOutput !== 0 && (
            <Flex direction="row" gap="size-100" justifyContent="space-between">
              <Text>output tokens</Text>
              <TokenCostsItem>{tokenCostOutput}</TokenCostsItem>
            </Flex>
          )}
          {tokenCostPromptAudio != null && tokenCostPromptAudio !== 0 && (
            <Flex direction="row" gap="size-100" justifyContent="space-between">
              <Text>prompt audio tokens</Text>
              <TokenCostsItem>{tokenCostPromptAudio}</TokenCostsItem>
            </Flex>
          )}
          {tokenCostCompletionAudio != null &&
            tokenCostCompletionAudio !== 0 && (
              <Flex
                direction="row"
                gap="size-100"
                justifyContent="space-between"
              >
                <Text>completion audio tokens</Text>
                <TokenCostsItem>{tokenCostCompletionAudio}</TokenCostsItem>
              </Flex>
            )}
          {tokenCostCacheRead != null && tokenCostCacheRead !== 0 && (
            <Flex direction="row" gap="size-100" justifyContent="space-between">
              <Text>cache read tokens</Text>
              <TokenCostsItem>{tokenCostCacheRead}</TokenCostsItem>
            </Flex>
          )}
          {tokenCostCacheWrite != null && tokenCostCacheWrite !== 0 && (
            <Flex direction="row" gap="size-100" justifyContent="space-between">
              <Text>cache write tokens</Text>
              <TokenCostsItem>{tokenCostCacheWrite}</TokenCostsItem>
            </Flex>
          )}
        </>
      )}
    </Flex>
  );
}

function TokenCostsItem({
  children,
  ...textProps
}: {
  children: number;
  size?: TextProps["size"];
}) {
  return <Text {...textProps}>{`$${Number(children.toPrecision(3))}`}</Text>;
}
