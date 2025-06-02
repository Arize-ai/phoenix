import { forwardRef, Ref } from "react";
import {
  DateField as AriaDateField,
  DateFieldProps as AriaDateFieldProps,
  DateValue,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "../field/styles";
import { StylableProps } from "../types";

export interface DateFieldProps<T extends DateValue>
  extends AriaDateFieldProps<T>,
    StylableProps {}

const dateFieldCSS = css`
  --date-field-vertical-padding: 6px;
  --date-field-horizontal-padding: 8px;
  color: var(--ac-global-text-color-900);

  .react-aria-DateInput {
    display: flex;
    padding: var(--date-field-vertical-padding)
      var(--date-field-horizontal-padding);
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    background-color: var(--ac-global-input-field-background-color);
    width: fit-content;
    box-sizing: border-box;
    min-width: 150px;
    white-space: nowrap;
    forced-color-adjust: none;

    &[data-focus-within] {
      outline: 1px solid var(--ac-global-color-primary);
      outline-offset: -1px;
    }

    &[data-invalid] {
      border-color: var(--ac-global-color-danger);
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
      color: var(--ac-text-color-placeholder);
      font-style: italic;
    }

    &:focus {
      color: var(--ac-highlight-foreground);
      background: var(--ac-highlight-background);
      outline: none;
      border-radius: var(--ac-global-rounding-small);
      caret-color: transparent;
    }
  }
`;

/**
 * A date field, can be used to input just a date as well as a date and time.
 */
function DateField<T extends DateValue>(
  props: DateFieldProps<T>,
  ref: Ref<HTMLDivElement>
) {
  const { css: propsCSS, ...restProps } = props;
  return (
    <AriaDateField
      css={css(fieldBaseCSS, dateFieldCSS, propsCSS)}
      {...restProps}
      ref={ref}
    />
  );
}

const _DateField = forwardRef(DateField);
export { _DateField as DateField };
