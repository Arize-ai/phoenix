import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import { Badge, Flex, IDBadge, Text } from "@phoenix/components";
import { SpanKindBadge } from "@phoenix/components/trace/SpanKindBadge";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import type { SpanStatusCodeType } from "@phoenix/components/trace/types";
import { useSpanStatusCodeColor } from "@phoenix/components/trace/useSpanStatusCodeColor";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanHeader_span$key } from "./__generated__/SpanHeader_span.graphql";
import type { SpanHeader_span$data } from "./__generated__/SpanHeader_span.graphql";

export type SpanHeaderData = Omit<SpanHeader_span$data, " $fragmentType">;

const identityRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  & > :not(.span-header__name, .span-header-skeleton__name) {
    flex: none;
  }
  .span-status-indicator + .span-header__name {
    transform: translateY(calc(-1 * var(--global-dimension-size-10)));
  }
  .span-header__status-message {
    flex: 0 1 auto;
    min-width: 0;
  }
  .span-header__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-left: auto;
  }
`;

const spanHeaderNameCSS = css`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const spanStatusIndicatorCSS = css`
  display: block;
  flex: none;
  width: var(--global-dimension-size-40);
  height: var(--global-dimension-size-250);
  border-radius: var(--global-rounding-xsmall);
  background-color: var(--span-status-indicator-color);
`;

const spanStatusMessageBadgeCSS = css`
  width: 100%;
  height: var(--global-dimension-size-250);
  padding: 0 var(--global-dimension-size-75);
  border-radius: var(--global-rounding-small);
  font-size: var(--global-dimension-font-size-75);
  line-height: var(--global-line-height-xs);
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

  return <SpanHeaderContent span={span} actions={props.actions} />;
}

/** Presentational span identity header used by the details page and Storybook. */
export function SpanHeaderContent({
  span,
  actions,
}: {
  span: SpanHeaderData;
  actions?: ReactNode;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const startTime = new Date(span.startTime);

  return (
    <Flex direction="column" gap="size-50" width="100%">
      <SpanHeaderIdentityRow>
        <SpanStatusIndicator statusCode={span.code} />
        <SpanHeaderName name={span.name} />
        {span.code === "ERROR" && span.statusMessage ? (
          <span
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
          </span>
        ) : null}
        {actions ? <div className="span-header__actions">{actions}</div> : null}
      </SpanHeaderIdentityRow>
      <SpanHeaderMetaRow>
        <SpanHeaderMetaItem>
          <SpanKindBadge spanKind={span.spanKind} />
        </SpanHeaderMetaItem>
        <SpanHeaderMetaItem>
          <IDBadge id={span.spanId} tooltipText="Copy Span ID" />
        </SpanHeaderMetaItem>
        {typeof span.latencyMs === "number" ? (
          <SpanHeaderMetaItem>
            <Text size="S" color="text-500" fontFamily="mono">
              {latencyMsFormatter(span.latencyMs)}
            </Text>
          </SpanHeaderMetaItem>
        ) : null}
        <SpanHeaderMetaItem>
          <Text size="S" color="text-500" fontFamily="mono">
            {fullTimeFormatter(startTime)}
          </Text>
        </SpanHeaderMetaItem>
        {span.tokenCountTotal ? (
          <SpanHeaderMetaItem>
            <SpanTokenCount
              tokenCountTotal={span.tokenCountTotal}
              nodeId={span.id}
              size="S"
              color="text-500"
            />
          </SpanHeaderMetaItem>
        ) : null}
        {span.costSummary?.total?.cost ? (
          <SpanHeaderMetaItem>
            <SpanTokenCosts
              totalCost={span.costSummary.total.cost}
              spanNodeId={span.id}
              size="S"
              color="text-500"
            />
          </SpanHeaderMetaItem>
        ) : null}
      </SpanHeaderMetaRow>
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
    <span
      role="img"
      aria-label={`Span status: ${statusCode}`}
      className="span-status-indicator"
      data-status-code={statusCode}
      css={spanStatusIndicatorCSS}
      style={{
        // @ts-expect-error custom CSS property
        "--span-status-indicator-color": `var(--global-color-${color})`,
      }}
    />
  );
}

/** Span name shared by loaded and preview detail headers. */
export function SpanHeaderName({ name }: { name: string }) {
  return (
    <Text
      size="L"
      weight="heavy"
      className="span-header__name"
      title={name}
      css={spanHeaderNameCSS}
    >
      {name}
    </Text>
  );
}

/** Identity row shared by loaded and preview detail headers. */
export function SpanHeaderIdentityRow({ children }: PropsWithChildren) {
  return (
    <div className="span-header__identity" css={identityRowCSS}>
      {children}
    </div>
  );
}

/** Metadata row shared by loaded and preview detail headers. */
export function SpanHeaderMetaRow({ children }: PropsWithChildren) {
  return (
    <div className="span-header__meta" css={metaRowCSS}>
      {children}
    </div>
  );
}

/** One metadata value in a span detail header. */
export function SpanHeaderMetaItem({ children }: PropsWithChildren) {
  return <span className="span-header__meta-item">{children}</span>;
}
