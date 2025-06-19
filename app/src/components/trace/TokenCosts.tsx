import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Loading, Text, TextProps } from "@phoenix/components";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

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
        <Text size={props.size}>{costFormatter(props.totalCost)}</Text>
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
          ... on Span {
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
                costPerToken
              }
            }
          }
          ... on Trace {
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
                costPerToken
              }
            }
          }
          ... on ProjectSession {
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
                costPerToken
              }
            }
          }
        }
      }
    `,
    { nodeId: props.nodeId }
  );

  const { promptDetails, completionDetails } = useMemo(() => {
    const details = data.node.costDetailSummaryEntries;
    if (!details) {
      return {
        promptDetails: [],
        completionDetails: [],
      };
    }
    return {
      promptDetails: details
        .filter((detail) => detail.isPrompt)
        .sort((a, b) => a.tokenType.localeCompare(b.tokenType)),
      completionDetails: details
        .filter((detail) => !detail.isPrompt)
        .sort((a, b) => a.tokenType.localeCompare(b.tokenType)),
    };
  }, [data.node.costDetailSummaryEntries]);

  return (
    (promptDetails.length > 0 || completionDetails.length > 0) && (
      <Flex direction="column" gap="size-50">
        {promptDetails.length > 0 && (
          <>
            <Text weight="heavy">Prompt</Text>
            {promptDetails.map((detail) => (
              <Flex
                key={detail.tokenType}
                direction="row"
                gap="size-100"
                justifyContent="space-between"
              >
                <Text>{`${detail.tokenType} tokens`}</Text>
                <Text>
                  {detail.value.cost ? costFormatter(detail.value.cost) : "?"}
                </Text>
              </Flex>
            ))}
          </>
        )}
        {completionDetails.length > 0 && (
          <>
            <Text weight="heavy">Completion</Text>
            {completionDetails.map((detail) => (
              <Flex
                key={detail.tokenType}
                direction="row"
                gap="size-100"
                justifyContent="space-between"
              >
                <Text>{`${detail.tokenType} tokens`}</Text>
                <Text>
                  {detail.value.cost ? costFormatter(detail.value.cost) : "?"}
                </Text>
              </Flex>
            ))}
          </>
        )}
      </Flex>
    )
  );
}
