import React, { forwardRef, Ref } from "react";
import {
  DateField as AriaDateField,
  DateFieldProps as AriaDateFieldProps,
  DateValue,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "../field/styles";

export type DateFieldProps<T extends DateValue> = AriaDateFieldProps<T>;

const dateFieldCSS = css`
  color: var(--ac-global-text-color-900);

  .react-aria-DateInput {
    display: flex;
    padding: 4px;
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    background-color: var(--ac-global-input-field-background-color);
    width: fit-content;
    min-width: 150px;
    white-space: nowrap;
    forced-color-adjust: none;

    &[data-focus-within] {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: -1px;
    }
  }

  .react-aria-DateSegment {
    padding: 0 2px;
    font-variant-numeric: tabular-nums;
    text-align: end;
    color: var(--ac-global-text-color-900);

    &[data-type="literal"] {
      padding: 0;
    }

    &[data-placeholder] {
      color: var(--text-color-placeholder);
      font-style: italic;
    }

    &:focus {
      background-color: var(--ac-global-input-field-border-color-active);
      color: var(--ac-global-text-color-900);
      outline: none;
      border-radius: var(--ac-global-rounding-small);
      caret-color: transparent;
    }
  }
`;
function DateField<T extends DateValue>(
  props: DateFieldProps<T>,
  ref: Ref<HTMLDivElement>
) {
  return (
    <AriaDateField css={css(fieldBaseCSS, dateFieldCSS)} {...props} ref={ref} />
  );
}

const _DateField = forwardRef(DateField);
export { _DateField as DateField };
