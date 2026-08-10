import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";

import { hasAnnotationValue } from "./annotationUtils";
import {
  getPositiveOptimizationFromConfig,
  type AnnotationOptimizationConfig,
} from "./optimizationUtils";
import type { Annotation } from "./types";

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

type AnnotationSummary = {
  name: string;
  meanScore?: number | null;
  labelFractions: readonly { label: string; fraction: number }[];
};

/**
 * A bare run of annotation tokens — the caller owns the layout (wrap, or
 * `OverflowRow`). Spans, traces and sessions read their annotations from
 * different Relay fragments but render them identically, so they share this.
 */
export function AnnotationSummaryTokens({
  summaries,
  annotationsByName,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: {
  summaries: readonly AnnotationSummary[];
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Record<string, readonly Annotation[] | undefined>;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  /** Grain-specific filter actions rendered in the popover's filters column */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  return (
    <>
      {summaries.map((summary) => {
        const latestAnnotation =
          annotationsByName[summary.name]?.find(hasAnnotationValue);
        const meanScore = summary?.meanScore;
        const annotationConfig = annotationConfigsByName.get(summary.name);
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationSummaryPopover
            key={latestAnnotation.id}
            annotations={annotationsByName[summary.name] ?? []}
            width="500px"
            meanScore={meanScore}
            annotationConfig={annotationConfig}
            showFilterActions={showFilterActions}
            renderFilterActions={renderFilterActions}
          >
            <AnnotationLabel
              annotation={latestAnnotation}
              annotationDisplayPreference="none"
              css={annotationLabelCSS}
            >
              {meanScore != null ? (
                <SummaryValuePreview
                  name={latestAnnotation.name}
                  meanScore={meanScore}
                  size="S"
                  disableAnimation
                  positiveOptimization={getPositiveOptimizationFromConfig({
                    config: annotationConfig,
                    score: meanScore,
                  })}
                />
              ) : (
                <SummaryValueLabelPreview
                  labelFractions={summary.labelFractions}
                />
              )}
            </AnnotationLabel>
          </AnnotationSummaryPopover>
        );
      })}
    </>
  );
}
