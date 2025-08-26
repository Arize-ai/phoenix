import { ReactNode } from "react";

import { RichTooltip, TooltipTrigger, TriggerWrap } from "@phoenix/components";

import { AnnotationDetailsContent } from "./AnnotationDetailsContent";
import { Annotation } from "./types";

/**
 * Wraps a component with a tooltip that displays information about an annotation.
 */
export function AnnotationTooltip({
  annotation,
  children,
}: {
  leadingExtra?: ReactNode;
  annotation: Annotation;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <TooltipTrigger delay={500}>
      <TriggerWrap>{children}</TriggerWrap>
      <RichTooltip offset={3}>
        <AnnotationDetailsContent annotation={annotation} />
      </RichTooltip>
    </TooltipTrigger>
  );
}
