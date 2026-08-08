import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

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
  categoricalAnnotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: {
  summaries: readonly AnnotationSummary[];
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Record<string, readonly Annotation[] | undefined>;
  categoricalAnnotationConfigsByName: Record<
    string,
    AnnotationConfigCategorical | undefined
  >;
  showFilterActions?: boolean;
  /** Grain-specific filter actions rendered in the popover's filters column */
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  return (
    <>
      {summaries.map((summary) => {
        const latestAnnotation = annotationsByName[summary.name]?.[0];
        const meanScore = summary?.meanScore;
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationSummaryPopover
            key={latestAnnotation.id}
            annotations={annotationsByName[summary.name] ?? []}
            width="500px"
            meanScore={meanScore}
            showFilterActions={showFilterActions}
            renderFilterActions={renderFilterActions}
          >
            <AnnotationLabel
              annotation={latestAnnotation}
              annotationDisplayPreference="none"
              css={annotationLabelCSS}
              clickable
            >
              {meanScore != null ? (
                <SummaryValuePreview
                  name={latestAnnotation.name}
                  meanScore={meanScore}
                  size="S"
                  disableAnimation
                  annotationConfig={
                    categoricalAnnotationConfigsByName[latestAnnotation.name]
                  }
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
