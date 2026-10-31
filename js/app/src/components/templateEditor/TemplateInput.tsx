import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

import { TemplateEditor } from "./TemplateEditor";
import type { TemplateFormat } from "./types";

type TemplateInputProps = {
  "aria-label": string;
  templateFormat: TemplateFormat;
  /** Initial text. The input is uncontrolled; remount (key) to replace it. */
  defaultValue: string;
  placeholder?: string;
  readOnly?: boolean;
  isInvalid?: boolean;
  /** Shown under the input, where a field's error slot would be. */
  errorMessage?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

// The design system's input chrome, applied to the editor so it sits in a
// form row beside TextFields without looking different. The code theme sets
// its own background with higher specificity, hence the override.
const templateInputCSS = css`
  --template-input-height: var(--global-input-height-s);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  min-width: 0;

  & .cm-editor {
    background-color: var(--field-background-color) !important;
    color: var(--field-text-color);
    border: var(--global-border-size-thin) solid var(--field-border-color);
    border-radius: var(--global-rounding-small);
    font-size: var(--global-font-size-s);
    transition: border-color 0.2s ease-in-out;
  }
  & .cm-editor:hover,
  & .cm-editor.cm-focused {
    outline: none;
    border-color: var(--field-border-color-active);
  }
  & .cm-editor:has(.cm-content:focus-visible) {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
  &[data-invalid="true"] .cm-editor {
    border-color: var(--field-invalid-border-color);
  }
  &[data-readonly="true"] .cm-editor {
    background-color: var(--field-readonly-background-color) !important;
    border-color: transparent;
  }
  // The one line scrolls sideways with the caret, as an input does, with no
  // scrollbar.
  & .cm-scroller {
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  & .cm-gutters {
    display: none;
  }
  & .cm-content {
    padding: 0 var(--global-dimension-size-100);
    min-height: 0;
    line-height: calc(
      var(--template-input-height) - 2 * var(--global-border-size-thin)
    );
  }
  & .cm-line {
    padding: 0;
  }
`;

/**
 * A one-line text input that highlights template variables, for short
 * fields whose text is substituted before it is sent (an option's or a
 * level's description). Uncontrolled, like {@link TemplateEditor}.
 */
export function TemplateInput({
  "aria-label": ariaLabel,
  templateFormat,
  defaultValue,
  placeholder,
  readOnly = false,
  isInvalid = false,
  errorMessage,
  onChange,
  onBlur,
}: TemplateInputProps) {
  return (
    <div
      className="template-input"
      css={templateInputCSS}
      data-invalid={isInvalid || undefined}
      data-readonly={readOnly || undefined}
    >
      <TemplateEditor
        singleLine
        aria-label={ariaLabel}
        templateFormat={templateFormat}
        defaultValue={defaultValue}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={onBlur}
      />
      {errorMessage ? (
        <Text size="XS" color="danger">
          {errorMessage}
        </Text>
      ) : null}
    </div>
  );
}
