import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, IDBadge, Text } from "@phoenix/components";
import { SpanKindBadge } from "@phoenix/components/trace/SpanKindBadge";
import { SpanStatusBadge } from "@phoenix/components/trace/SpanStatusBadge";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
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
        <SpanKindBadge spanKind={span.spanKind} />
        <SpanHeaderName name={span.name} />
        <SpanStatusBadge statusCode={span.code} labelVariant="full" />
        {actions ? <div className="span-header__actions">{actions}</div> : null}
      </SpanHeaderIdentityRow>
      <SpanHeaderMetaRow>
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
