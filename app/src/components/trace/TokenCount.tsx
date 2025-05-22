import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import {
  Flex,
  Icon,
  Icons,
  Loading,
  Text,
  TextProps,
} from "@phoenix/components";

import type { TokenCount_TokenDetailsQuery } from "./__generated__/TokenCount_TokenDetailsQuery.graphql";

type TokenCountProps = {
  /**
   * The total number of tokens in the prompt and completion
   */
  tokenCountTotal: number;
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
 * Displays the number of tokens in the prompt and completion
 */
export function TokenCount(props: TokenCountProps) {
  return (
    <TooltipTrigger delay={500}>
      <TriggerWrap>
        <TokenItem size={props.size}>{props.tokenCountTotal}</TokenItem>
      </TriggerWrap>
      <Tooltip>
        <Suspense fallback={<Loading />}>
          <TokenDetails nodeId={props.nodeId} />
        </Suspense>
      </Tooltip>
    </TooltipTrigger>
  );
}

function TokenDetails(props: { nodeId: string }) {
  const data = useLazyLoadQuery<TokenCount_TokenDetailsQuery>(
    graphql`
      query TokenCount_TokenDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            tokenCountPrompt
            tokenCountCompletion
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
    { nodeId: props.nodeId }
  );

  const { tokenCountPrompt, tokenCountCompletion } = useMemo(() => {
    switch (data.node.__typename) {
      case "Span":
        return {
          tokenCountPrompt: data.node.tokenCountPrompt ?? 0,
          tokenCountCompletion: data.node.tokenCountCompletion ?? 0,
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
        <TokenItem>{tokenCountPrompt}</TokenItem>
      </Flex>
      <Flex direction="row" gap="size-100" justifyContent="space-between">
        <Text>completion tokens</Text>
        <TokenItem>{tokenCountCompletion}</TokenItem>
      </Flex>
    </Flex>
  );
}

function TokenItem({
  children,
  ...textProps
}: {
  children: number;
  size?: TextProps["size"];
}) {
  return (
    <Flex
      direction="row"
      gap="size-50"
      alignItems="center"
      className="token-count-item"
    >
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: var(--ac-global-text-color-900);
        `}
      />
      <Text {...textProps}>{children}</Text>
    </Flex>
  );
}
