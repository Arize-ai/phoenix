import { css } from "@emotion/react";

import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  AnnotationValuePopover,
  type AnnotationValuePopoverProps,
  type AnnotationValuePopoverRenderTrigger,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import {
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

import type { Annotation, AnnotationConfig } from "./types";

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

type EditableAnnotationPopoverProps = Pick<
  AnnotationValuePopoverProps,
  | "onCreateAnnotation"
  | "onCreateAnnotationConfig"
  | "onDeleteAnnotation"
  | "onUpdateAnnotation"
  | "onUpdateAnnotationConfig"
  | "target"
> & {
  annotationConfigsByName: Partial<Record<string, AnnotationConfig>>;
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
  editableAnnotationPopover,
  showFilterActions = false,
}: {
  summaries: readonly AnnotationSummary[];
  /** Every annotation behind a summary, newest first, keyed by summary name */
  annotationsByName: Record<string, readonly Annotation[] | undefined>;
  categoricalAnnotationConfigsByName: Record<
    string,
    AnnotationConfigCategorical | undefined
  >;
  editableAnnotationPopover?: EditableAnnotationPopoverProps;
  showFilterActions?: boolean;
}) {
  return (
    <>
      {summaries.map((summary) => {
        const latestAnnotation = annotationsByName[summary.name]?.[0];
        const meanScore = summary?.meanScore;
        if (!latestAnnotation) {
          return null;
        }
        const renderTrigger: AnnotationValuePopoverRenderTrigger = ({
          ref,
        }) => (
          <AnnotationLabel
            ref={ref}
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
        );
        if (editableAnnotationPopover) {
          const { annotationConfigsByName, ...annotationValuePopoverProps } =
            editableAnnotationPopover;
          return (
            <AnnotationValuePopover
              key={latestAnnotation.id}
              annotationName={summary.name}
              annotations={annotationsByName[summary.name] ?? []}
              config={annotationConfigsByName[summary.name] ?? null}
              displayMode="table"
              renderTrigger={renderTrigger}
              {...annotationValuePopoverProps}
            />
          );
        }
        return (
          <AnnotationSummaryPopover
            key={latestAnnotation.id}
            annotations={annotationsByName[summary.name] ?? []}
            width="500px"
            meanScore={meanScore}
            showFilterActions={showFilterActions}
          >
            {renderTrigger({ ref: null })}
          </AnnotationSummaryPopover>
        );
      })}
    </>
  );
}
