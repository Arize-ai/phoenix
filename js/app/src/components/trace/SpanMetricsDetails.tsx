import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanMetricsDetailsQuery } from "./__generated__/SpanMetricsDetailsQuery.graphql";
import {
  getTokenCostDetailsFromCostDetails,
  TokenCostsDetails,
} from "./TokenCostsDetails";
import {
  getTokenCountDetailsFromCostDetails,
  TokenCountDetails,
} from "./TokenCountDetails";

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  &:not(:first-of-type) {
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

/**
 * Everything the trace tree's metrics row summarizes, in full: latency, the
 * token breakdown, and the cost breakdown of a single span.
 *
 * @remarks
 * Loads with one query so a tooltip over the row opens with one round trip.
 * Mount it lazily (inside the tooltip) so a tree of hundreds of spans does
 * not fetch details for rows the user never hovers.
 */
export function SpanMetricsDetails(props: { spanNodeId: string }) {
  const data = useLazyLoadQuery<SpanMetricsDetailsQuery>(
    graphql`
      query SpanMetricsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on Span {
            latencyMs
            tokenCountTotal
            tokenCountPrompt
            tokenCountCompletion
            costSummary {
              total {
                cost
              }
              prompt {
                cost
              }
              completion {
                cost
              }
            }
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
              }
            }
          }
        }
      }
    `,
    { nodeId: props.spanNodeId }
  );

  if (data.node.__typename !== "Span") {
    return null;
  }
  const span = data.node;
  const hasTokens = span.tokenCountTotal != null;
  const costTotal = span.costSummary?.total?.cost;
  const hasCost = costTotal != null;

  const costDetails = span.costDetailSummaryEntries;

  return (
    <Flex direction="column">
      <section css={sectionCSS}>
        <Flex direction="row" justifyContent="space-between" gap="size-200">
          <Text size="S" color="text-700">
            Latency
          </Text>
          <Text size="S" fontFamily="mono">
            {latencyMsFormatter(span.latencyMs)}
          </Text>
        </Flex>
      </section>
      {hasTokens ? (
        <section css={sectionCSS}>
          <TokenCountDetails
            total={span.tokenCountTotal}
            prompt={span.tokenCountPrompt}
            completion={span.tokenCountCompletion}
            {...getTokenCountDetailsFromCostDetails(costDetails)}
          />
        </section>
      ) : null}
      {hasCost ? (
        <section css={sectionCSS}>
          <TokenCostsDetails
            total={costTotal}
            prompt={span.costSummary?.prompt?.cost}
            completion={span.costSummary?.completion?.cost}
            {...getTokenCostDetailsFromCostDetails(costDetails)}
          />
        </section>
      ) : null}
    </Flex>
  );
}
