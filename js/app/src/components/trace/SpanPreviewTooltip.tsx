import { RichTooltip, TooltipArrow } from "@phoenix/components";

import type { SpanMetricsDetailsQuery as SpanMetricsDetailsQueryType } from "./__generated__/SpanMetricsDetailsQuery.graphql";
import { rowPreviewTooltipCSS, RowPreviewQuery } from "./RowPreviewQuery";
import {
  SpanMetricsDetailsQuery,
  useSpanMetricsDetailsProps,
} from "./SpanMetricsDetails";
import type { SpanPreviewCardProps } from "./SpanPreviewCard";
import { SpanPreviewCard } from "./SpanPreviewCard";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "./TokenDetailsBreakdown";

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
      css={rowPreviewTooltipCSS}
    >
      {/* The arrow points at the row the preview describes */}
      <TooltipArrow />
      <SpanPreviewDetails {...props} />
    </RichTooltip>
  );
}

const EMPTY_METRICS_DETAILS: TokenDetailsBreakdownProps = {};

function SpanPreviewDetails(props: SpanPreviewTooltipProps) {
  const { span } = props;
  // Annotations come with the tree, so a span without usage has nothing to load
  if (!span.tokenCountTotal && !span.costSummary?.total?.cost) {
    return (
      <SpanPreviewCard {...props} metricsDetails={EMPTY_METRICS_DETAILS} />
    );
  }
  return (
    <RowPreviewQuery<SpanMetricsDetailsQueryType>
      query={SpanMetricsDetailsQuery}
      variables={{ nodeId: span.id }}
      placeholder={<SpanPreviewCard {...props} />}
    >
      {(data) => (
        <LoadedSpanPreviewCard
          {...props}
          node={data.node.__typename === "Span" ? data.node : null}
        />
      )}
    </RowPreviewQuery>
  );
}

function LoadedSpanPreviewCard({
  node,
  ...props
}: SpanPreviewTooltipProps & {
  node: Parameters<typeof useSpanMetricsDetailsProps>[0];
}) {
  const metricsDetails = useSpanMetricsDetailsProps(node);
  return (
    <SpanPreviewCard
      {...props}
      metricsDetails={metricsDetails ?? EMPTY_METRICS_DETAILS}
    />
  );
}
