import { css } from "@emotion/react";
import { useId } from "react";

import { Text } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { sortAnnotationSummariesForTriage } from "@phoenix/components/annotation/annotationSummaryUtils";
import { AnnotationSummaryValue } from "@phoenix/components/annotation/AnnotationSummaryValue";
import {
  type AnnotationOptimizationConfig,
  getOptimizationValueFromConfig,
} from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { classNames } from "@phoenix/utils/classNames";

const annotationsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);

  .span-preview-annotations__title {
    display: flex;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    white-space: nowrap;
  }
  .span-preview-annotations__list {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .span-preview-annotation {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  /* A tinted value's chip height, so untinted rows keep the same pitch */
  .span-preview-annotations__list--tinted .span-preview-annotation {
    min-height: calc(
      var(--global-line-height-s) + 2 * var(--global-dimension-size-25)
    );
  }
  .span-preview-annotation__name {
    ${truncateSingleCSS}
    flex: 1 1 auto;
    min-width: 4ch;
  }
  .span-preview-annotation__count {
    flex: none;
  }
  .span-preview-annotation__value {
    flex: 0 1 auto;
    max-width: 60%;
    white-space: nowrap;
  }
`;

export type SpanPreviewAnnotationsProps = {
  summaries: readonly AnnotationSummary[] | null | undefined;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /**
   * The section's heading.
   * @default "Annotations"
   */
  title?: string;
  /**
   * Rows to show before the rest are counted in a "+N more" line. A preview
   * closes when the pointer leaves its row, so it can't scroll. Shows every
   * row when left out.
   */
  maxRows?: number;
  /**
   * Whether to show "x of y unfavorable" by the heading. Unfavorable means
   * past the optimization pivot, which defaults to the bounds' midpoint.
   * @default true
   */
  showUnfavorableCount?: boolean;
};

/**
 * One row per annotation name: its combined label and mean score, tinted by
 * its optimization config, unfavorable first, with how many are unfavorable
 * by the heading. Explanations are left out
 * because they belong to single annotations and do not aggregate. Renders
 * nothing without summaries.
 */
export function SpanPreviewAnnotations({
  summaries,
  annotationConfigsByName,
  title = "Annotations",
  maxRows,
  showUnfavorableCount = true,
}: SpanPreviewAnnotationsProps) {
  const headingId = useId();
  if (!summaries?.length) {
    return null;
  }
  const rows = sortAnnotationSummariesForTriage(
    summaries,
    annotationConfigsByName
  ).map((summary) => ({
    summary,
    optimizationValue: getOptimizationValueFromConfig({
      config: annotationConfigsByName.get(summary.name),
      score: summary.meanScore,
    }),
  }));
  const unfavorableCount = rows.filter(
    (row) => (row.optimizationValue ?? 0) < 0
  ).length;
  const shownRows = maxRows == null ? rows : rows.slice(0, maxRows);
  const hiddenCount = rows.length - shownRows.length;
  const hasTintedValue = shownRows.some(
    ({ summary, optimizationValue }) =>
      optimizationValue != null &&
      typeof summary.meanScore === "number" &&
      !Number.isNaN(summary.meanScore)
  );
  return (
    <section
      className="span-preview-annotations"
      css={annotationsCSS}
      aria-labelledby={headingId}
    >
      <div className="span-preview-annotations__title">
        <Text id={headingId} size="S" weight="heavy">
          {title}
        </Text>
        {showUnfavorableCount && unfavorableCount > 0 ? (
          <Text size="XS" color="danger">
            {`${unfavorableCount} of ${rows.length} unfavorable`}
          </Text>
        ) : null}
      </div>
      <ul
        className={classNames(
          "span-preview-annotations__list",
          hasTintedValue && "span-preview-annotations__list--tinted"
        )}
      >
        {shownRows.map(({ summary, optimizationValue }) => (
          <li key={summary.name} className="span-preview-annotation">
            <AnnotationColorSwatch annotationName={summary.name} />
            <Text
              size="S"
              className="span-preview-annotation__name"
              title={summary.name}
            >
              {summary.name}
            </Text>
            {summary.count != null && summary.count > 1 ? (
              <Text
                size="XS"
                color="text-500"
                className="span-preview-annotation__count"
              >
                {`×${summary.count}`}
              </Text>
            ) : null}
            <AnnotationSummaryValue
              summary={summary}
              optimizationValue={optimizationValue}
              className="span-preview-annotation__value"
            />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <Text size="XS" color="text-500">
          {`+${hiddenCount} more`}
        </Text>
      ) : null}
    </section>
  );
}
