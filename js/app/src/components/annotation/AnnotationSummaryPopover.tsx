import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { useRef, useState } from "react";
import { useInteractOutside } from "react-aria";
import { Button as AriaButton } from "react-aria-components";

import { Popover, PopoverArrow, PreviewTrigger } from "@phoenix/components";
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
    props: AnnotationSummaryFilterActionsRenderProps
  ) => ReactNode;
}) {
  const prototypicalAnnotation = annotations[0];
  const popoverRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const shouldKeepPreviewOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const onPreviewOpenChange = (isNextOpen: boolean) => {
    if (!isNextOpen && shouldKeepPreviewOpenRef.current) {
      return;
    }
    setIsOpen(isNextOpen);
  };

  const onFilterMenuOpenChange = (isNextOpen: boolean) => {
    shouldKeepPreviewOpenRef.current = isNextOpen;
    if (isNextOpen) {
      setIsOpen(true);
    }
  };

  const closePreview = () => {
    shouldKeepPreviewOpenRef.current = false;
    setIsOpen(false);
  };

  useInteractOutside({
    ref: popoverRef,
    isDisabled: !isOpen,
    onInteractOutside: (event) => {
      if (
        event.target instanceof Node &&
        filterPopoverRef.current?.contains(event.target)
      ) {
        return;
      }
      closePreview();
    },
  });

  if (!prototypicalAnnotation) {
    return null;
  }

  return (
    <StopPropagation>
      <PreviewTrigger isOpen={isOpen} onOpenChange={onPreviewOpenChange}>
        <AriaButton
          css={annotationSummaryTriggerCSS}
          aria-label={`View ${prototypicalAnnotation.name} annotation details`}
        >
          {children}
        </AriaButton>
        <Popover
          ref={popoverRef}
          css={annotationSummaryPopoverCSS}
          placement="right top"
          aria-label={`${prototypicalAnnotation.name} annotation details`}
        >
          <PopoverArrow />
          <AnnotationDetailsList
            annotations={annotations}
            annotationConfig={annotationConfig}
            renderFilterActions={
              showFilterActions
                ? ({ annotation, positiveOptimization }) =>
                    renderFilterActions ? (
                      renderFilterActions({
                        annotation,
                        positiveOptimization,
                        onOpenChange: onFilterMenuOpenChange,
                        popoverRef: filterPopoverRef,
                      })
                    ) : (
                      <SpanAnnotationTooltipFilterActions
                        annotation={annotation}
                        positiveOptimization={positiveOptimization}
                        targetKind="span"
                        onOpenChange={onFilterMenuOpenChange}
                        popoverRef={filterPopoverRef}
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

type AnnotationSummaryFilterActionsRenderProps = {
  annotation: Annotation;
  positiveOptimization: boolean | null | undefined;
  onOpenChange: (isOpen: boolean) => void;
  popoverRef: Ref<HTMLDivElement>;
};
