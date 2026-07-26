import { css } from "@emotion/react";
import type { PropsWithChildren, Ref } from "react";
import { Button as AriaButton } from "react-aria-components";

import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";

import type { Annotation, AnnotationDisplayPreference } from "./types";

export const baseAnnotationLabelCSS = css`
  border-radius: var(--global-dimension-size-50);
  border: 1px solid var(--global-border-color-default);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  transition: background-color 0.2s;
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-50);
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  overflow: hidden;
  color: inherit;
  font: inherit;
  background: transparent;
  text-align: left;
  &[data-clickable="true"] {
    cursor: pointer;
    &:hover {
      background-color: var(--global-color-gray-300);
    }

    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
  &[data-variant="ghost"] {
    border-style: dashed;
    border-color: var(--global-text-color-500);
    color: var(--global-text-color-300);
  }
  .icon-wrap {
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
  variant = "default",
  onFocus,
  ref,
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
  /** A subdued, dashed label for a configured annotation without a value. */
  variant?: "default" | "ghost";
  onFocus?: () => void;
  /** Ref applied to the underlying button when the label is clickable. */
  ref?: Ref<HTMLButtonElement>;
}>) {
  const clickable = _clickable ?? typeof onClick == "function";
  const content = (
    <>
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference={
          variant === "ghost" ? "none" : annotationDisplayPreference
        }
        showColorSwatch={false}
      />
      {variant === "default" ? children : null}
    </>
  );

  if (clickable) {
    return (
      <AriaButton
        ref={ref}
        type="button"
        data-clickable="true"
        data-variant={variant}
        className={className}
        css={css(baseAnnotationLabelCSS)}
        aria-label={`Open ${annotation.name} annotation`}
        onFocus={onFocus}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
      >
        {content}
      </AriaButton>
    );
  }

  return (
    <div
      data-clickable={clickable}
      data-variant={variant}
      className={className}
      css={css(baseAnnotationLabelCSS)}
      aria-label={`Annotation: ${annotation.name}`}
    >
      {content}
    </div>
  );
}
