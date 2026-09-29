import { css } from "@emotion/react";
import { useId } from "react";

import { Text } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import {
  getAnnotationSummaryPositiveOptimization,
  getAnnotationSummaryTopLabel,
  sortAnnotationSummariesForTriage,
} from "@phoenix/components/annotation/annotationSummaryUtils";
import { groupAnnotationsByName } from "@phoenix/components/annotation/annotationUtils";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import {
  Truncate,
  truncateSingleCSS,
} from "@phoenix/components/core/utility/Truncate";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export type SpanPreviewAnnotation = {
  readonly name: string;
  readonly explanation?: string | null;
  readonly createdAt: string;
};

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
  /* Matches the tinted chip's inset so a column's values end at one edge */
  .span-preview-annotation__value:not([data-direction]) {
    padding-inline: var(--global-dimension-size-100);
  }
  .span-preview-annotation__value[data-unrecorded] {
    color: var(--global-text-color-300);
  }
  /* Swatch width plus gap, so the caption aligns with the name */
  .span-preview-annotation__explanation td {
    padding-top: var(--global-dimension-size-25);
    padding-left: calc(8px + var(--global-dimension-size-100));
  }
`;

export type SpanPreviewAnnotationsProps = {
  summaries: readonly AnnotationSummary[] | null | undefined;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /** Omit while loading; rows then show values without explanations. */
  annotations?: readonly SpanPreviewAnnotation[] | null;
};

/** Values come from the row's summaries, so the table renders before details load. */
export function SpanPreviewAnnotations({
  summaries,
  annotationConfigsByName,
  annotations: loadedAnnotations,
}: SpanPreviewAnnotationsProps) {
  const headingId = useId();
  if (!summaries?.length) {
    return null;
  }
  const annotationsByName = groupAnnotationsByName(loadedAnnotations ?? []);
  const rows = sortAnnotationSummariesForTriage(
    summaries,
    annotationConfigsByName
  ).map((summary) => ({
    summary,
    positiveOptimization: getAnnotationSummaryPositiveOptimization({
      summary,
      annotationConfig: annotationConfigsByName.get(summary.name),
    }),
    annotations: annotationsByName[summary.name] ?? [],
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
        aria-busy={loadedAnnotations == null}
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
          {rows.flatMap(({ summary, positiveOptimization, annotations }) => {
            const [latestAnnotation] = annotations;
            const explanation = latestAnnotation?.explanation;
            const count = summary.count ?? annotations.length;
            const label = getAnnotationSummaryTopLabel(summary);
            const score =
              summary.meanScore != null ? formatFloat(summary.meanScore) : null;
            const summaryRow = (
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
                    {count > 1 ? (
                      <Text size="XS" color="text-500">
                        {`×${count}`}
                      </Text>
                    ) : null}
                  </span>
                </th>
                <td className="span-preview-annotation__label">
                  <AnnotationValue
                    positiveOptimization={positiveOptimization}
                    title={label}
                  >
                    {label}
                  </AnnotationValue>
                </td>
                <td className="span-preview-annotation__score">
                  <AnnotationValue
                    positiveOptimization={positiveOptimization}
                    fontFamily="mono"
                  >
                    {score}
                  </AnnotationValue>
                </td>
              </tr>
            );
            if (!explanation) {
              return [summaryRow];
            }
            return [
              summaryRow,
              <tr
                key={`${summary.name}-explanation`}
                className="span-preview-annotation__explanation"
              >
                <td colSpan={3}>
                  <Truncate maxLines={2} title={explanation}>
                    <Text size="XS" color="text-500">
                      {explanation}
                    </Text>
                  </Truncate>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnnotationValue({
  children,
  positiveOptimization,
  fontFamily,
  title,
}: {
  children: string | null;
  positiveOptimization: boolean | null;
  fontFamily?: "mono";
  title?: string | null;
}) {
  return (
    <AnnotationScoreText
      elementType="span"
      size="S"
      fontFamily={fontFamily}
      className="span-preview-annotation__value"
      title={title ?? undefined}
      positiveOptimization={children == null ? null : positiveOptimization}
      data-unrecorded={children == null || undefined}
    >
      {children ?? "--"}
    </AnnotationScoreText>
  );
}
