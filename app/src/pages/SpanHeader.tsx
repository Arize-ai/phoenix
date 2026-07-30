import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import { Badge, CopyableIDBadge, Flex, Text } from "@phoenix/components";
import { SpanKindBadge } from "@phoenix/components/trace/SpanKindBadge";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import type { SpanStatusCodeType } from "@phoenix/components/trace/types";
import { useSpanStatusCodeColor } from "@phoenix/components/trace/useSpanStatusCodeColor";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanHeader_span$key } from "./__generated__/SpanHeader_span.graphql";
import type { SpanHeader_span$data } from "./__generated__/SpanHeader_span.graphql";
import {
  DetailHeaderBadge,
  DetailHeaderIdentityRow,
  DetailHeaderMetaItem,
  DetailHeaderMetaRow,
  DetailHeaderStatusIndicator,
  DetailHeaderTitle,
} from "./DetailHeader";

export type SpanHeaderData = Omit<SpanHeader_span$data, " $fragmentType">;

const spanStatusMessageBadgeCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  height: var(--global-dimension-size-250);
  padding: 0 var(--global-dimension-size-75);
  border-radius: var(--global-rounding-small);
  font-size: var(--global-dimension-font-size-75);
  line-height: var(--global-line-height-xs);
`;

type SpanHeaderProps = {
  span: SpanHeader_span$key;
  /**
   * Actions rendered at the trailing edge of the identity row
   */
  actions?: ReactNode;
  /**
   * Control rendered at the trailing edge of the metadata row
   */
  metadataAction?: ReactNode;
};

/**
 * Identifies a span with identity and metadata rows.
 */
export function SpanHeader(props: SpanHeaderProps) {
  const span = useFragment(
    graphql`
      fragment SpanHeader_span on Span {
        id
        name
        spanKind
        spanId
        code: statusCode
        statusMessage
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

  return (
    <SpanHeaderContent
      span={span}
      actions={props.actions}
      metadataAction={props.metadataAction}
    />
  );
}

/** Presentational span identity header used by the details page and Storybook. */
export function SpanHeaderContent({
  span,
  actions,
  metadataAction,
}: {
  span: SpanHeaderData;
  actions?: ReactNode;
  metadataAction?: ReactNode;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const startTime = new Date(span.startTime);

  return (
    <Flex direction="column" gap="size-50" width="100%">
      <DetailHeaderIdentityRow>
        <SpanStatusIndicator statusCode={span.code} />
        <DetailHeaderTitle title={span.name} />
        <CopyableIDBadge
          id={span.spanId}
          showValue={false}
          tooltipText="Copy Span ID"
        />
        {span.code === "ERROR" && span.statusMessage ? (
          <DetailHeaderBadge
            className="span-header__status-message"
            title={span.statusMessage}
          >
            <Badge
              variant="danger"
              size="M"
              overflowMode="truncate"
              css={spanStatusMessageBadgeCSS}
            >
              {span.statusMessage}
            </Badge>
          </DetailHeaderBadge>
        ) : null}
        {actions ? (
          <div className="detail-header__actions span-header__actions">
            {actions}
          </div>
        ) : null}
      </DetailHeaderIdentityRow>
      <DetailHeaderMetaRow trailing={metadataAction}>
        <DetailHeaderMetaItem>
          <SpanKindBadge spanKind={span.spanKind} />
        </DetailHeaderMetaItem>
        {typeof span.latencyMs === "number" ? (
          <DetailHeaderMetaItem>
            <Text size="S" color="text-500" fontFamily="mono">
              {latencyMsFormatter(span.latencyMs)}
            </Text>
          </DetailHeaderMetaItem>
        ) : null}
        <DetailHeaderMetaItem>
          <Text size="S" color="text-500" fontFamily="mono">
            {fullTimeFormatter(startTime)}
          </Text>
        </DetailHeaderMetaItem>
        {span.tokenCountTotal ? (
          <DetailHeaderMetaItem>
            <SpanTokenCount
              tokenCountTotal={span.tokenCountTotal}
              nodeId={span.id}
              size="S"
              color="text-500"
            />
          </DetailHeaderMetaItem>
        ) : null}
        {span.costSummary?.total?.cost ? (
          <DetailHeaderMetaItem>
            <SpanTokenCosts
              totalCost={span.costSummary.total.cost}
              spanNodeId={span.id}
              size="S"
              color="text-500"
            />
          </DetailHeaderMetaItem>
        ) : null}
      </DetailHeaderMetaRow>
    </Flex>
  );
}

/** Compact color marker for a span's status in a detail header. */
export function SpanStatusIndicator({
  statusCode,
}: {
  statusCode: SpanStatusCodeType;
}) {
  const color = useSpanStatusCodeColor(statusCode);

  return (
    <DetailHeaderStatusIndicator
      ariaLabel={`Span status: ${statusCode}`}
      className="span-status-indicator"
      color={color}
      lightColor={statusCode === "OK" ? "green-600" : undefined}
      statusCode={statusCode}
    />
  );
}
