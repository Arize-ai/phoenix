import { css } from "@emotion/react";
import { type ReactNode, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import {
  Popover,
  PopoverArrow,
  PreviewTrigger,
  VisuallyHidden,
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
  meanScore,
  showFilterActions,
  renderFilterActions,
}: {
  /** Annotations of the same name, newest first. */
  annotations: Annotation[] | readonly Annotation[];
  children: ReactNode;
  annotationConfig?: AnnotationOptimizationConfig;
  meanScore?: number | null;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const prototypicalAnnotation = annotations[0];
  if (!prototypicalAnnotation) {
    return null;
  }

  return (
    <StopPropagation>
      <PreviewTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <AriaButton
          css={annotationSummaryTriggerCSS}
          // PreviewTrigger handles hover, focus, and long press; add ordinary
          // press so mouse and touch users can toggle the same popover.
          onPress={() => setIsOpen((isOpen) => !isOpen)}
        >
          {children}
          <VisuallyHidden>View annotation details</VisuallyHidden>
        </AriaButton>
        <Popover
          css={annotationSummaryPopoverCSS}
          placement="right top"
          aria-label={`${prototypicalAnnotation.name} annotation details`}
        >
          <PopoverArrow />
          <AnnotationDetailsList
            annotations={annotations}
            annotationConfig={annotationConfig}
            meanScore={meanScore}
            renderFilterActions={
              showFilterActions
                ? (annotation) =>
                    renderFilterActions ? (
                      renderFilterActions(annotation)
                    ) : (
                      <SpanAnnotationTooltipFilterActions
                        annotation={annotation}
                      />
                    )
                : undefined
            }
          />
        </Popover>
      </PreviewTrigger>
    </StopPropagation>
  );
}
