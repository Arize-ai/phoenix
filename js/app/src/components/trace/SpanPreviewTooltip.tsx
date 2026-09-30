import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import { createOperationDescriptor, getRequest } from "relay-runtime";

import { ErrorBoundary, RichTooltip, TooltipArrow } from "@phoenix/components";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import { useRetainQuery } from "@phoenix/contexts/QueryRetentionContext";
import { useSettled } from "@phoenix/hooks";

import type { SpanMetricsDetailsQuery as SpanMetricsDetailsQueryType } from "./__generated__/SpanMetricsDetailsQuery.graphql";
import {
  SpanMetricsDetailsQuery,
  useSpanMetricsDetailsProps,
} from "./SpanMetricsDetails";
import type { SpanPreviewCardProps } from "./SpanPreviewCard";
import { SpanPreviewCard } from "./SpanPreviewCard";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "./TokenDetailsBreakdown";

/**
 * How long a tooltip stays open before its span's details are fetched.
 * React Aria opens each tooltip at once after the first, so without this a
 * scrub down the tree would fetch details for every row it crossed.
 */
const DETAILS_SETTLE_MS = 150;

/**
 * The preview follows the pointer from row to row, so it neither fades in
 * nor lingers: each hop shows the next span at once.
 */
const spanPreviewTooltipCSS = css`
  transition: none;
  &[data-entering],
  &[data-exiting] {
    transform: none;
    opacity: 1;
  }
`;

export type SpanPreviewTooltipProps = Pick<
  SpanPreviewCardProps,
  "span" | "annotationConfigsByName"
>;

/**
 * A trace tree row's tooltip: a {@link SpanPreviewCard} that loads the span's
 * token and cost breakdown once the tooltip settles.
 *
 * @remarks
 * Render it as the tooltip of a `TooltipTrigger` around the row, which
 * anchors it beside the row and wires the row's hover, focus, Escape and
 * `aria-describedby` for it. Every row's box starts at the tree's edge, so
 * the preview holds one horizontal position as the pointer moves down the
 * tree whatever the nesting, and the arrow and the row's hover fill, which
 * reaches that same edge, tie the two together.
 */
export function SpanPreviewTooltip(props: SpanPreviewTooltipProps) {
  return (
    <RichTooltip
      placement="left top"
      width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
      className="span-preview"
      css={spanPreviewTooltipCSS}
    >
      {/* The arrow points at the row the preview describes */}
      <TooltipArrow />
      <SpanPreviewDetails {...props} />
    </RichTooltip>
  );
}

const EMPTY_METRICS_DETAILS: TokenDetailsBreakdownProps = {};

function getDetailsOperation(spanId: string) {
  return createOperationDescriptor(getRequest(SpanMetricsDetailsQuery), {
    nodeId: spanId,
  });
}

function SpanPreviewDetails(props: SpanPreviewTooltipProps) {
  const { span } = props;
  // Annotations come with the tree, so a span without usage has nothing to load
  if (!span.tokenCountTotal && !span.costSummary?.total?.cost) {
    return (
      <SpanPreviewCard {...props} metricsDetails={EMPTY_METRICS_DETAILS} />
    );
  }
  return <SpanPreviewUsageDetails {...props} />;
}

function SpanPreviewUsageDetails(props: SpanPreviewTooltipProps) {
  const environment = useRelayEnvironment();
  // Details already in the store when the tooltip opens skip the settle, so
  // revisited rows never pop in
  const [wasCached] = useState(
    () =>
      environment.check(getDetailsOperation(props.span.id)).status ===
      "available"
  );
  const placeholder = <SpanPreviewCard {...props} />;
  const details = (
    <ErrorBoundary fallback={TextErrorBoundaryFallback}>
      <Suspense fallback={placeholder}>
        <LoadedSpanPreviewCard {...props} />
      </Suspense>
    </ErrorBoundary>
  );
  if (wasCached) {
    return details;
  }
  return <AfterSettle placeholder={placeholder}>{details}</AfterSettle>;
}

function AfterSettle({
  placeholder,
  children,
}: {
  placeholder: ReactNode;
  children: ReactNode;
}) {
  const hasSettled = useSettled(DETAILS_SETTLE_MS);
  return hasSettled ? children : placeholder;
}

function LoadedSpanPreviewCard(props: SpanPreviewTooltipProps) {
  const data = useLazyLoadQuery<SpanMetricsDetailsQueryType>(
    SpanMetricsDetailsQuery,
    { nodeId: props.span.id }
  );
  useRetainQuery(getDetailsOperation(props.span.id));
  const node = data.node.__typename === "Span" ? data.node : null;
  const metricsDetails = useSpanMetricsDetailsProps(node);
  return (
    <SpanPreviewCard
      {...props}
      metricsDetails={metricsDetails ?? EMPTY_METRICS_DETAILS}
    />
  );
}
