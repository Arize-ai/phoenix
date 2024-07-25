import React, { ReactNode, useState } from "react";
import { clsx as classNames } from "clsx";
import { css } from "@emotion/react";

import { ValidationState } from "@arizeai/components";

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
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid var(--ac-global-input-field-border-color);
  width: 100%;
  .cm-gutters,
  .cm-content,
  .cm-editor {
    border-radius: var(--ac-global-rounding-medium);
  }
  .cm-focused {
    outline: none;
  }
  transition: all 0.2s ease-in-out;
`;

/**
 * Wrapper for code editor components (e.g. JSONEditor) that provides hover, focus, and validation state styles
 */
export function CodeEditorFormWrapper({
  children,
  validationState,
}: {
  children: ReactNode;
  validationState: ValidationState;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isInvalid = validationState === "invalid";
  return (
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
    >
      {children}
    </div>
  );
}
