import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";

import {
  Dialog,
  Popover,
  PopoverArrow,
  PreviewTrigger,
} from "@phoenix/components";
import { AnnotationDetailsList } from "@phoenix/components/annotation/AnnotationDetailsList";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { SpanAnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";

import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { Annotation } from "./types";

const annotationSummaryTriggerCSS = css`
  all: unset;
  display: inline-flex;
  border-radius: var(--global-rounding-small);
  cursor: pointer;
  transition: background-color 0.2s;

  &[data-hovered] {
    background-color: var(--global-color-gray-300);
  }

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

const annotationSummaryPopoverCSS = css`
  width: min(520px, calc(100vw - var(--global-dimension-size-400)));
  max-width: 100%;
`;

export function AnnotationSummaryPopover({
  annotations,
  children,
  annotationConfig,
  showFilterActions,
  renderFilterActions,
}: {
  /** Annotations of the same name, newest first. */
  annotations: Annotation[] | readonly Annotation[];
  children: ReactNode;
  annotationConfig?: AnnotationOptimizationConfig;
  showFilterActions?: boolean;
  renderFilterActions?: (
    annotation: Annotation,
    positiveOptimization: boolean | null | undefined
  ) => ReactNode;
}) {
  const prototypicalAnnotation = annotations[0];

  if (!prototypicalAnnotation) {
    return null;
  }

  return (
    <StopPropagation>
      <PreviewTrigger>
        <AriaButton
          css={annotationSummaryTriggerCSS}
          aria-label={`View ${prototypicalAnnotation.name} annotation details`}
        >
          {children}
        </AriaButton>
        <Popover
          css={annotationSummaryPopoverCSS}
          offset={8}
          placement="right top"
          isNonModal
          shouldCloseOnInteractOutside={(element) =>
            !element.closest("[data-annotation-filter-menu]")
          }
        >
          <PopoverArrow />
          <Dialog
            aria-label={`${prototypicalAnnotation.name} annotation details`}
          >
            <AnnotationDetailsList
              annotations={annotations}
              annotationConfig={annotationConfig}
              renderFilterActions={
                showFilterActions
                  ? (annotation, positiveOptimization) =>
                      renderFilterActions ? (
                        renderFilterActions(annotation, positiveOptimization)
                      ) : (
                        <SpanAnnotationTooltipFilterActions
                          annotation={annotation}
                          positiveOptimization={positiveOptimization}
                          targetKind="span"
                        />
                      )
                  : undefined
              }
            />
          </Dialog>
        </Popover>
      </PreviewTrigger>
    </StopPropagation>
  );
}
