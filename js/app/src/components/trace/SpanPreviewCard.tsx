import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import { useTimeFormatters } from "@phoenix/hooks";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import type { SpanPreviewAnnotation } from "./SpanPreviewAnnotations";
import { SpanPreviewAnnotations } from "./SpanPreviewAnnotations";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import {
  TokenDetailsBreakdown,
  TokenDetailsBreakdownSkeleton,
} from "./TokenDetailsBreakdown";
import type { ISpanItem } from "./types";

const cardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);

  .span-preview__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .span-preview__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .span-preview__timing {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--global-dimension-size-200);
    white-space: nowrap;
  }
  /* Dividers between sections run to the tooltip's edges while content keeps its inset */
  .span-preview__header ~ * + * {
    margin-inline: calc(-1 * var(--rich-tooltip-padding-x, 0px));
    padding-inline: var(--rich-tooltip-padding-x, 0px);
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

export type SpanPreviewCardProps = {
  span: ISpanItem;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /** Omit while loading; the annotations table then shows values only. */
  annotations?: readonly SpanPreviewAnnotation[] | null;
  /** Omit while loading; a skeleton then surrounds the span's known totals. */
  metricsDetails?: TokenDetailsBreakdownProps | null;
};

/**
 * The content of a trace tree row's preview: header, timing, annotations,
 * then tokens and cost. Pure, so every state renders from plain data;
 * `SpanPreviewTooltip` loads the details and passes them in.
 */
export function SpanPreviewCard({
  span,
  annotationConfigsByName,
  annotations,
  metricsDetails,
}: SpanPreviewCardProps) {
  return (
    <div className="span-preview-card" css={cardCSS}>
      <header className="span-preview__header">
        <SpanKindIcon spanKind={span.spanKind} />
        <Text weight="heavy" className="span-preview__name" title={span.name}>
          {span.name}
        </Text>
        {span.statusCode === "ERROR" ? (
          <SpanStatusCodeIcon statusCode="ERROR" />
        ) : null}
      </header>
      <SpanTimingDetails
        startTime={span.startTime}
        endTime={span.endTime}
        latencyMs={span.latencyMs}
      />
      <SpanPreviewAnnotations
        summaries={span.spanAnnotationSummaries}
        annotationConfigsByName={annotationConfigsByName}
        annotations={annotations}
      />
      {metricsDetails ? (
        <TokenDetailsBreakdown {...metricsDetails} />
      ) : (
        <TokenDetailsBreakdownSkeleton
          tokens={{ total: span.tokenCountTotal }}
          costs={{ total: span.costSummary?.total?.cost }}
        />
      )}
    </div>
  );
}

/**
 * One line: when the span started and ended on the left, and how long that
 * took on the right. Every span has these, so a tool or chain span without
 * tokens still has a preview worth opening. Times stop at the second: the
 * latency beside them carries the finer resolution.
 */
function SpanTimingDetails({
  startTime,
  endTime,
  latencyMs,
}: Pick<ISpanItem, "startTime" | "endTime" | "latencyMs">) {
  const { timeOfDayFormatter } = useTimeFormatters();
  return (
    <div className="span-preview__timing">
      <Text size="S" fontFamily="mono" color="text-700">
        {timeOfDayFormatter(new Date(startTime))}
        {" to "}
        {endTime ? timeOfDayFormatter(new Date(endTime)) : "now"}
      </Text>
      <LatencyText latencyMs={latencyMs} size="S" showIcon={false} />
    </div>
  );
}
