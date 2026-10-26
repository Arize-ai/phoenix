import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";

import { RowPreviewCard } from "./RowPreviewCard";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanPreviewAnnotations } from "./SpanPreviewAnnotations";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import type { ISpanItem } from "./types";

const cardCSS = css`
  .span-preview-card__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export type SpanPreviewCardProps = {
  span: ISpanItem;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /** Omit while loading; a skeleton then surrounds the span's known totals. */
  metricsDetails?: TokenDetailsBreakdownProps | null;
};

/** The content of a trace tree row's preview; `SpanPreviewTooltip` loads its details. */
export function SpanPreviewCard({
  span,
  annotationConfigsByName,
  metricsDetails,
}: SpanPreviewCardProps) {
  return (
    <RowPreviewCard
      className="span-preview-card"
      css={cardCSS}
      header={
        <>
          <SpanKindIcon spanKind={span.spanKind} />
          <Text
            weight="heavy"
            className="span-preview-card__name"
            title={span.name}
          >
            {span.name}
          </Text>
          {span.statusCode === "ERROR" ? (
            <SpanStatusCodeIcon statusCode="ERROR" />
          ) : null}
        </>
      }
      timing={{
        startTime: span.startTime,
        endTime: span.endTime,
        latencyMs: span.latencyMs,
      }}
      metricsDetails={metricsDetails}
      totals={{
        tokens: span.tokenCountTotal,
        cost: span.costSummary?.total?.cost,
      }}
    >
      <SpanPreviewAnnotations
        summaries={span.spanAnnotationSummaries}
        annotationConfigsByName={annotationConfigsByName}
      />
    </RowPreviewCard>
  );
}
