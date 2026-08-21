import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { Annotation, AnnotationTargetType } from "./types";

/* Keeps a value-less token the same height as one with a score/label chart. */
const tokenMinHeight = "var(--global-dimension-size-250)";

const annotationLabelCSS = css`
  min-height: ${tokenMinHeight};
  align-items: center;
  justify-content: center;
  display: flex;
`;

const annotationValueCSS = css`
  min-height: ${tokenMinHeight};
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  display: flex;
  align-items: center;
`;

export type AnnotationSummary = {
  name: string;
  meanScore?: number | null;
  labelFractions: readonly { label: string; fraction: number }[];
};

type AnnotationSummaryTokenProps = {
  summary: AnnotationSummary;
  annotationTargetType: AnnotationTargetType;
  /** Every annotation behind the summary, newest first. */
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
  showFilterActions?: boolean;
  /** Filter actions for one annotation, specific to its target type. */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
  /**
   * The full token includes the annotation name for mixed-summary contexts.
   * The value variant omits the repeated name for a named table column.
   */
  variant?: "token" | "value";
};

function AnnotationSummaryToken({
  summary,
  annotationTargetType,
  annotations,
  annotationConfig,
  showFilterActions = false,
  renderFilterActions,
  variant = "token",
}: AnnotationSummaryTokenProps) {
  const latestValuedAnnotation = annotations.find(hasAnnotationValue);
  // Explanation-only entries belong in details but cannot represent a token.
  if (variant === "token" && !latestValuedAnnotation) {
    return null;
  }
  const prototypicalAnnotation = latestValuedAnnotation ?? annotations[0];
  if (!prototypicalAnnotation) {
    return null;
  }
  const meanScore = summary.meanScore;
  const value =
    meanScore != null ? (
      <SummaryValuePreview
        name={prototypicalAnnotation.name}
        meanScore={meanScore}
        size="S"
        disableAnimation
        annotationConfig={annotationConfig}
      />
    ) : summary.labelFractions.length > 0 ? (
      <SummaryValueLabelPreview
        labelFractions={summary.labelFractions}
        size="S"
      />
    ) : (
      <Text size="L">--</Text>
    );

  return (
    <AnnotationSummaryPopover
      annotations={annotations}
      annotationTargetType={annotationTargetType}
      annotationConfig={annotationConfig}
      meanScore={meanScore}
      showFilterActions={showFilterActions}
      renderFilterActions={renderFilterActions}
    >
      {variant === "token" ? (
        <AnnotationLabel
          annotation={prototypicalAnnotation}
          annotationDisplayPreference="none"
          css={annotationLabelCSS}
        >
          {value}
        </AnnotationLabel>
      ) : (
        <div css={annotationValueCSS}>{value}</div>
      )}
    </AnnotationSummaryPopover>
  );
}

/**
 * The flat table-column cell for one named annotation: finds the named
 * summary within a target's summary group and renders it as a value-variant
 * token. Spans, traces and sessions read their annotations from different
 * Relay fragments but render the cell identically, so they share this.
 */
export function AnnotationSummaryValueToken({
  annotationName,
  annotationTargetType,
  sortedSummariesByName,
  annotationsByName,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: {
  annotationName: string;
  annotationTargetType: AnnotationTargetType;
  sortedSummariesByName: readonly AnnotationSummary[];
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Partial<Record<string, readonly Annotation[]>>;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  /** Filter actions for one annotation, specific to its target type. */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  const summary = sortedSummariesByName.find(
    (summary) => summary.name === annotationName
  );
  const annotations = annotationsByName[annotationName] ?? [];
  if (!summary || annotations.length === 0) {
    return null;
  }
  return (
    <AnnotationSummaryToken
      summary={summary}
      annotationTargetType={annotationTargetType}
      annotations={annotations}
      annotationConfig={annotationConfigsByName.get(annotationName)}
      showFilterActions={showFilterActions}
      renderFilterActions={renderFilterActions}
      variant="value"
    />
  );
}

/**
 * A bare run of annotation tokens — the caller owns the layout (wrap, or
 * `OverflowRow`). Spans, traces and sessions read their annotations from
 * different Relay fragments but render them identically, so they share this.
 */
export function AnnotationSummaryTokens({
  summaries,
  annotationTargetType,
  annotationsByName,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: {
  summaries: readonly AnnotationSummary[];
  annotationTargetType: AnnotationTargetType;
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Partial<Record<string, readonly Annotation[]>>;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  /** Filter actions for one annotation, specific to its target type. */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  return (
    <>
      {summaries.map((summary) => (
        <AnnotationSummaryToken
          key={summary.name}
          summary={summary}
          annotationTargetType={annotationTargetType}
          annotations={annotationsByName[summary.name] ?? []}
          annotationConfig={annotationConfigsByName.get(summary.name)}
          showFilterActions={showFilterActions}
          renderFilterActions={renderFilterActions}
        />
      ))}
    </>
  );
}
