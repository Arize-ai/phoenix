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
import type { Annotation, AnnotationScope } from "./types";

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

const annotationValueCSS = css`
  min-height: 20px;
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
  annotationScope: AnnotationScope;
  /** Every annotation behind the summary, newest first. */
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
  showFilterActions?: boolean;
  /** Grain-specific filter actions rendered for each annotation. */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
  /**
   * The full token includes the annotation name for mixed-summary contexts.
   * The value variant omits the repeated name for a named table column.
   */
  variant?: "token" | "value";
};

export function AnnotationSummaryToken({
  summary,
  annotationScope,
  annotations,
  annotationConfig,
  showFilterActions = false,
  renderFilterActions,
  variant = "token",
}: AnnotationSummaryTokenProps) {
  const latestValuedAnnotation = annotations.find(hasAnnotationValue);
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
      annotationScope={annotationScope}
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
 * A bare run of annotation tokens — the caller owns the layout (wrap, or
 * `OverflowRow`). Spans, traces and sessions read their annotations from
 * different Relay fragments but render them identically, so they share this.
 */
export function AnnotationSummaryTokens({
  summaries,
  annotationScope,
  annotationsByName,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: {
  summaries: readonly AnnotationSummary[];
  annotationScope: AnnotationScope;
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Partial<Record<string, readonly Annotation[]>>;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  /** Grain-specific filter actions rendered for each annotation. */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  return (
    <>
      {summaries.map((summary) => {
        // Explanation-only entries belong in details but cannot represent a token.
        const annotations = annotationsByName[summary.name] ?? [];
        const latestAnnotation = annotations.find(hasAnnotationValue);
        const annotationConfig = annotationConfigsByName.get(summary.name);
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationSummaryToken
            key={latestAnnotation.id}
            summary={summary}
            annotationScope={annotationScope}
            annotations={annotations}
            annotationConfig={annotationConfig}
            showFilterActions={showFilterActions}
            renderFilterActions={renderFilterActions}
          />
        );
      })}
    </>
  );
}
