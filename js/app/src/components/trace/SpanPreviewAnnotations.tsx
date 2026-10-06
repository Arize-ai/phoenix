import { css } from "@emotion/react";
import { useId } from "react";

import { Text } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { AnnotationLabelConsensusText } from "@phoenix/components/annotation/AnnotationLabelConsensusText";
import {
  getAnnotationSummaryPositiveOptimization,
  sortAnnotationSummariesForTriage,
} from "@phoenix/components/annotation/annotationSummaryUtils";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";

const tableCSS = css`
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;

  th,
  td {
    padding: 0;
    vertical-align: middle;
  }
  thead th {
    font-weight: normal;
    text-align: right;
    padding-bottom: var(--global-dimension-size-100);
    vertical-align: baseline;
  }
  thead th:not(:first-of-type) {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .span-preview-annotations-table__title {
    display: flex;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    white-space: nowrap;
  }
  tbody tr.span-preview-annotation:not(:first-of-type) > * {
    padding-top: var(--global-dimension-size-100);
  }
  .span-preview-annotation__name {
    width: 100%;
    max-width: 0;
    text-align: left;
    font-weight: normal;
  }
  .span-preview-annotation__name-label {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .span-preview-annotation__name-text {
    ${truncateSingleCSS}
    min-width: 0;
  }
  .span-preview-annotation__label,
  .span-preview-annotation__score {
    padding-left: var(--global-dimension-size-100);
    text-align: right;
    white-space: nowrap;
  }
  .span-preview-annotation__value {
    ${truncateSingleCSS}
    display: inline-block;
    max-width: 16ch;
    vertical-align: middle;
  }
  /* Matches the tinted chip's inset so the column's values end at one edge */
  .span-preview-annotation__score
    .span-preview-annotation__value:not(:has([data-direction])) {
    padding-inline: var(--global-dimension-size-100);
  }
`;

export type SpanPreviewAnnotationsProps = {
  summaries: readonly AnnotationSummary[] | null | undefined;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
};

const UNRECORDED = (
  <Text size="S" color="text-300">
    --
  </Text>
);

/**
 * One row per annotation name: how far its labels agree and its mean score.
 * Explanations are left out because they belong to single annotations and
 * do not aggregate.
 */
export function SpanPreviewAnnotations({
  summaries,
  annotationConfigsByName,
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
    positiveOptimization: getAnnotationSummaryPositiveOptimization({
      summary,
      annotationConfig: annotationConfigsByName.get(summary.name),
    }),
  }));
  const unfavorableCount = rows.filter(
    (row) => row.positiveOptimization === false
  ).length;
  return (
    // The card pads its sections, and a collapsed-border table ignores padding
    <div className="span-preview__annotations">
      <table
        className="span-preview-annotations-table"
        css={tableCSS}
        aria-labelledby={headingId}
      >
        <thead>
          <tr>
            <th scope="col" className="span-preview-annotation__name">
              <span className="span-preview-annotations-table__title">
                <Text id={headingId} size="S" weight="heavy">
                  Annotations
                </Text>
                {unfavorableCount > 0 ? (
                  <Text size="XS" color="danger">
                    {`${unfavorableCount} of ${rows.length} unfavorable`}
                  </Text>
                ) : null}
              </span>
            </th>
            <th scope="col">
              <Text size="XS" color="text-500">
                Label
              </Text>
            </th>
            <th scope="col">
              <Text size="XS" color="text-500">
                Score
              </Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ summary, positiveOptimization }) => (
            <tr key={summary.name} className="span-preview-annotation">
              <th scope="row" className="span-preview-annotation__name">
                <span className="span-preview-annotation__name-label">
                  <AnnotationColorSwatch annotationName={summary.name} />
                  <Text
                    size="S"
                    className="span-preview-annotation__name-text"
                    title={summary.name}
                  >
                    {summary.name}
                  </Text>
                  {summary.count != null && summary.count > 1 ? (
                    <Text size="XS" color="text-500">
                      {`×${summary.count}`}
                    </Text>
                  ) : null}
                </span>
              </th>
              <td className="span-preview-annotation__label">
                <AnnotationLabelConsensusText
                  summary={summary}
                  fallback={UNRECORDED}
                  className="span-preview-annotation__value"
                />
              </td>
              <td className="span-preview-annotation__score">
                <MeanScore
                  value={summary.meanScore}
                  positiveOptimization={positiveOptimization}
                  fallback={UNRECORDED}
                  size="S"
                  className="span-preview-annotation__value"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
