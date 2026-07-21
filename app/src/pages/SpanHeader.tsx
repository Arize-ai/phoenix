import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, IDBadge, Text } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusBadge } from "@phoenix/components/trace/SpanStatusBadge";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanHeader_span$key } from "./__generated__/SpanHeader_span.graphql";

const spanNameCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type SpanHeaderProps = {
  span: SpanHeader_span$key;
  /**
   * Actions rendered at the trailing edge of the identity row
   */
  actions?: ReactNode;
};

/**
 * Identifies a span: an identity row (kind, name, status) with actions at the
 * trailing edge, above a full-width meta row (id, latency, time, tokens, cost).
 */
export function SpanHeader(props: SpanHeaderProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  const span = useFragment(
    graphql`
      fragment SpanHeader_span on Span {
        id
        name
        spanKind
        spanId
        code: statusCode
        latencyMs
        startTime
        tokenCountTotal
        costSummary {
          total {
            cost
          }
        }
      }
    `,
    props.span
  );

  const startTime = useMemo<Date>(() => {
    return new Date(span.startTime);
  }, [span.startTime]);

  return (
    <Flex direction="column" gap="size-50" width="100%">
      <Flex direction="row" gap="size-100" alignItems="center">
        <SpanKindToken spanKind={span.spanKind} />
        <Text size="L" css={spanNameCSS} title={span.name}>
          {span.name}
        </Text>
        <SpanStatusBadge statusCode={span.code} labelVariant="full" />
        {props.actions ? (
          <Flex
            flex="none"
            direction="row"
            alignItems="center"
            gap="size-100"
            marginStart="auto"
          >
            {props.actions}
          </Flex>
        ) : null}
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <IDBadge id={span.spanId} tooltipText="Copy Span ID" />
        {typeof span.latencyMs === "number" ? (
          <LatencyText latencyMs={span.latencyMs} size="S" />
        ) : null}
        <Text color="text-500" size="S">
          at {fullTimeFormatter(startTime)}
        </Text>
        {span.tokenCountTotal ? (
          <SpanTokenCount
            tokenCountTotal={span.tokenCountTotal}
            nodeId={span.id}
            size="S"
          />
        ) : null}
        {span.costSummary?.total?.cost ? (
          <SpanTokenCosts
            totalCost={span.costSummary.total.cost}
            spanNodeId={span.id}
            size="S"
          />
        ) : null}
      </Flex>
    </Flex>
  );
}
