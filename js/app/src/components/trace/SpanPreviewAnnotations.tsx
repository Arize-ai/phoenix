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

/**
 * One annotation behind a summary, as the preview's details load it:
 * enough to show why the latest result came out the way it did.
 */
export type SpanPreviewAnnotation = {
  readonly name: string;
  readonly explanation?: string | null;
  /** ISO timestamp; the newest annotation of a name is the one explained. */
  readonly createdAt: string;
};

/*
 * Laid out like the token breakdown table under it: uppercase XS headings,
 * a word-color swatch before each name, and values set to the right in the
 * tinted chips of the large annotation label.
 */
const tableCSS = css`
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;

  th,
  td {
    padding: 0;
    vertical-align: middle;
  }
  /* The title heads the name column, so it shares a line with the column
     headings */
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
  /* Every row after the first opens with the same gap, whether or not an
     explanation sits above it */
  tbody tr.span-preview-annotation:not(:first-of-type) > * {
    padding-top: var(--global-dimension-size-100);
  }
  /* The name column takes the slack so the values stay tight */
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
  .span-preview-annotation__value[data-unrecorded] {
    color: var(--global-text-color-300);
  }
  /* The caption sits under the name, past the swatch */
  .span-preview-annotation__explanation td {
    padding-top: var(--global-dimension-size-25);
    padding-left: calc(8px + var(--global-dimension-size-100));
  }
`;

export type SpanPreviewAnnotationsProps = {
  /** The span's summaries as the trace tree row holds them. */
  summaries: readonly AnnotationSummary[] | null | undefined;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /**
   * The span's annotations, in any order. `null` or absent while they load:
   * the table then shows each summary's values without an explanation.
   */
  annotations?: readonly SpanPreviewAnnotation[] | null;
};

/**
 * The span's annotations for its preview, as a small table: each name with
 * its label and score, unfavorable first, colored by whether the result is
 * favorable under the project's config, and the explanation behind the
 * latest one under it. The values render from what the tree row already
 * holds; the explanations arrive with the preview's details.
 */
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
    // A block around the table: the card's section rules pad it, and a
    // collapsed-border table takes no padding of its own
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
            // Newest first, so this is the annotation the summary most reflects
            const explanation = annotations[0]?.explanation;
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

/**
 * A label or score in the tinted chip of the large annotation label, or a
 * muted dash when the annotation did not record it. Every value keeps the
 * chip's inset, so tinted, plain and missing values line up down a column;
 * a dash is not a result, so it is never tinted.
 */
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
      reserveInset
      positiveOptimization={children == null ? null : positiveOptimization}
      data-unrecorded={children == null || undefined}
    >
      {children ?? "--"}
    </AnnotationScoreText>
  );
}
