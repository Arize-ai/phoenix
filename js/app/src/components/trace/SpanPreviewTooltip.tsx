import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { ErrorBoundary, RichTooltip, TooltipArrow } from "@phoenix/components";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import { useSettled } from "@phoenix/hooks";

import type { SpanPreviewTooltipDetailsQuery as SpanPreviewTooltipDetailsQueryType } from "./__generated__/SpanPreviewTooltipDetailsQuery.graphql";
import { useSpanMetricsDetailsProps } from "./SpanMetricsDetails";
import type { SpanPreviewCardProps } from "./SpanPreviewCard";
import { SpanPreviewCard } from "./SpanPreviewCard";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "./TokenDetailsBreakdown";

/**
 * How long a tooltip stays open before its span's details are fetched.
 * React Aria opens each tooltip at once after the first, so without this a
 * scrub down the tree would fetch details for every row it crossed.
 */
const DETAILS_SETTLE_MS = 150;

/**
 * Everything the preview loads lazily, in one round trip: the annotations
 * behind the badges and the token and cost breakdown.
 */
const SpanPreviewTooltipDetailsQuery = graphql`
  query SpanPreviewTooltipDetailsQuery($nodeId: ID!) {
    node(id: $nodeId) {
      __typename
      ... on Span {
        previewSpanAnnotations: spanAnnotations(
          filter: { exclude: { names: ["note"] } }
        ) {
          id
          name
          explanation
          createdAt
        }
        ...SpanMetricsDetails_span
      }
    }
  }
`;

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
 * The trace tree row's rich tooltip: a {@link SpanPreviewCard} for the span,
 * filled in with the details it loads.
 *
 * @remarks
 * Render it as the tooltip of a `TooltipTrigger` around the row, which
 * anchors it beside the row and wires the row's hover, focus, Escape and
 * `aria-describedby` for it. Every row's box starts at the tree's edge, so
 * the preview holds one horizontal position as the pointer moves down the
 * tree whatever the nesting, and the arrow and the row's hover fill, which
 * reaches that same edge, tie the two together.
 *
 * The card renders at once from what the row already holds. The details
 * behind it, the explanation of each annotation and the token breakdown, are
 * fetched together only once the tooltip has stayed open a moment, so a
 * scrub down the tree fetches details for the rows the pointer rests on and
 * no others.
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

/** The card from the row's data, then from the loaded details. */
function SpanPreviewDetails(props: SpanPreviewTooltipProps) {
  const hasSettled = useSettled(DETAILS_SETTLE_MS);
  const placeholder = <SpanPreviewCard {...props} />;
  if (!hasSettled) {
    return placeholder;
  }
  return (
    <ErrorBoundary fallback={TextErrorBoundaryFallback}>
      <Suspense fallback={placeholder}>
        <LoadedSpanPreviewCard {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Loads the span's details and hands them to the card as plain data. */
function LoadedSpanPreviewCard(props: SpanPreviewTooltipProps) {
  const data = useLazyLoadQuery<SpanPreviewTooltipDetailsQueryType>(
    SpanPreviewTooltipDetailsQuery,
    { nodeId: props.span.id }
  );
  const node = data.node.__typename === "Span" ? data.node : null;
  const metricsDetails = useSpanMetricsDetailsProps(node);
  return (
    <SpanPreviewCard
      {...props}
      annotations={node?.previewSpanAnnotations ?? []}
      metricsDetails={metricsDetails ?? {}}
    />
  );
}
