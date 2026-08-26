import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, IDBadge, Text } from "@phoenix/components";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusBadge } from "@phoenix/components/trace/SpanStatusBadge";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanHeader_span$key } from "./__generated__/SpanHeader_span.graphql";

const identityRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  & > * {
    flex: none;
  }
  .span-header__name {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .span-header__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-left: auto;
  }
`;

const metaRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  .span-header__meta-item {
    display: inline-flex;
    align-items: center;
  }
  .span-header__meta-item + .span-header__meta-item::before {
    content: "·";
    color: var(--global-text-color-300);
    margin-right: var(--global-dimension-size-100);
  }
`;

type SpanHeaderProps = {
  span: SpanHeader_span$key;
  /**
   * Actions rendered at the trailing edge of the identity row
   */
  actions?: ReactNode;
};

/**
 * Identifies a span: an identity row (kind, name, status) with actions at
 * the trailing edge, above a full-width meta row (id, latency, time, tokens,
 * cost) of uniformly muted mono text separated by dots.
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
      <div className="span-header__identity" css={identityRowCSS}>
        <SpanKindToken spanKind={span.spanKind} />
        <Text
          size="L"
          weight="heavy"
          className="span-header__name"
          title={span.name}
        >
          {span.name}
        </Text>
        <SpanStatusBadge statusCode={span.code} labelVariant="full" />
        {props.actions ? (
          <div className="span-header__actions">{props.actions}</div>
        ) : null}
      </div>
      <div className="span-header__meta" css={metaRowCSS}>
        <span className="span-header__meta-item">
          <IDBadge
            id={span.spanId}
            variant="quiet"
            tooltipText="Copy Span ID"
          />
        </span>
        {typeof span.latencyMs === "number" ? (
          <span className="span-header__meta-item">
            <Text size="S" color="text-500" fontFamily="mono">
              {latencyMsFormatter(span.latencyMs)}
            </Text>
          </span>
        ) : null}
        <span className="span-header__meta-item">
          <Text size="S" color="text-500" fontFamily="mono">
            {fullTimeFormatter(startTime)}
          </Text>
        </span>
        {span.tokenCountTotal ? (
          <span className="span-header__meta-item">
            <SpanTokenCount
              tokenCountTotal={span.tokenCountTotal}
              nodeId={span.id}
              size="S"
              color="text-500"
            />
          </span>
        ) : null}
        {span.costSummary?.total?.cost ? (
          <span className="span-header__meta-item">
            <SpanTokenCosts
              totalCost={span.costSummary.total.cost}
              spanNodeId={span.id}
              size="S"
              color="text-500"
            />
          </span>
        ) : null}
      </div>
    </Flex>
  );
}
