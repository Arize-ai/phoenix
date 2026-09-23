import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { outlinedPillCSS } from "@phoenix/components/core/styles";

import type { Annotation, AnnotationDisplayPreference } from "./types";

export const baseAnnotationLabelCSS = css(
  outlinedPillCSS,
  css`
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    display: flex;
    flex-direction: row;
    gap: var(--global-dimension-size-50);
    .icon-wrap {
      font-size: 12px;
    }
  `
);

export function AnnotationLabel({
  annotation,
  onClick,
  annotationDisplayPreference = "score",
  className,
  children,
}: PropsWithChildren<{
  annotation: Annotation;
  onClick?: () => void;
  /**
   * The preferred value to display in the annotation label.
   * If the provided value is not available, it will fallback to an available value.
   * - "label": Display the annotation label.
   * - "score": Display the annotation score.
   * - "none": Do not display the annotation label or score.
   * @default "score"
   */
  annotationDisplayPreference?: AnnotationDisplayPreference;
  className?: string;
}>) {
  const clickable = typeof onClick === "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      data-clickable={clickable}
      className={className}
      css={css(baseAnnotationLabelCSS)}
      aria-label={clickable ? "Click to view the annotation trace" : undefined}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }
      }}
    >
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference={annotationDisplayPreference}
      />
      {children}
    </div>
  );
}
