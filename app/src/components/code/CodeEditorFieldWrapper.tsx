import { ReactNode, useId, useState } from "react";
import { css } from "@emotion/react";

import { Label, Text } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { classNames } from "@phoenix/utils";

const codeEditorFormWrapperCSS = css`
  &.is-hovered {
    border: 1px solid var(--ac-global-input-field-border-color-active);
  }
  &.is-focused {
    border: 1px solid var(--ac-global-input-field-border-color-active);
  }
  &.is-invalid {
    border: 1px solid var(--ac-global-color-danger);
  }
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid var(--ac-global-input-field-border-color);
  width: 100%;
  .cm-content,
  .cm-editor {
    border-radius: var(--ac-global-rounding-small);
  }
  box-sizing: border-box;
  .cm-focused {
    outline: none;
  }
  transition: all 0.2s ease-in-out;
`;

/**
 * Wrapper for code editor components (e.g. JSONEditor) that provides hover, focus, and validation state styles.
 * Includes proper ARIA attributes for accessibility.
 */
export function CodeEditorFieldWrapper({
  children,
  label,
  errorMessage,
  description,
}: {
  children: ReactNode;
  label: string;
  errorMessage?: string | null;
  description?: string | null;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isInvalid = !!errorMessage;

  // Generate unique IDs for ARIA associations
  const baseId = useId();
  const errorId = `${baseId}-error`;
  const descriptionId = `${baseId}-description`;

  // Build aria-describedby based on what's displayed
  const ariaDescribedBy = errorMessage
    ? errorId
    : description
      ? descriptionId
      : undefined;

  return (
    <div css={fieldBaseCSS}>
      <Label>{label}</Label>
      <div
        className={classNames("json-editor-wrap", {
          "is-hovered": isHovered,
          "is-focused": isFocused,
          "is-invalid": isInvalid,
        })}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        css={codeEditorFormWrapperCSS}
        role="textbox"
        aria-invalid={isInvalid}
        aria-describedby={ariaDescribedBy}
      >
        {children}
      </div>
      {errorMessage ? (
        <Text id={errorId} slot="errorMessage" color="danger" role="alert">
          {errorMessage}
        </Text>
      ) : null}
      {description && !errorMessage ? (
        <Text id={descriptionId} slot="description">
          {description}
        </Text>
      ) : null}
    </div>
  );
}
