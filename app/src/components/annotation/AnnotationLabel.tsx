import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";

import type { Annotation, AnnotationDisplayPreference } from "./types";

export const baseAnnotationLabelCSS = css`
  border-radius: var(--global-dimension-size-50);
  border: 1px solid var(--global-color-gray-400);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  transition: background-color 0.2s;
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-50);
  &[data-clickable="true"] {
    cursor: pointer;
    &:hover {
      background-color: var(--global-color-gray-300);
    }
  }
  .ac-icon-wrap {
    font-size: 12px;
  }
`;

export function AnnotationLabel({
  annotation,
  onClick,
  annotationDisplayPreference = "score",
  className,
  children,
  clickable: _clickable,
}: PropsWithChildren<{
  annotation: Annotation;
  /**
   * Override "clickable" detection. By default, clickable will only be true if onClick is provided.
   * However, you may manually want to set this to true in cases where the annotation is wrapped in a
   * clickable element (e.g. a dialog trigger, a link, etc).
   */
  clickable?: boolean;
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
  const clickable = _clickable ?? typeof onClick == "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      data-clickable={clickable}
      className={className}
      css={css(baseAnnotationLabelCSS)}
      aria-label={
        clickable
          ? "Click to view the annotation trace"
          : `Annotation: ${annotation.name}`
      }
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
