import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type {
  DateFieldProps as AriaDateFieldProps,
  DateValue,
} from "react-aria-components";
import { DateField as AriaDateField } from "react-aria-components";

import { fieldBaseCSS } from "../field/styles";
import type { StylableProps } from "../types";

export interface DateFieldProps<T extends DateValue>
  extends AriaDateFieldProps<T>, StylableProps {}

const dateFieldCSS = css`
  --date-field-vertical-padding: 6px;
  --date-field-horizontal-padding: 8px;
  color: var(--global-text-color-900);

  &[data-size="S"] .react-aria-DateInput {
    height: var(--global-input-height-s);
  }

  &[data-size="M"] .react-aria-DateInput {
    height: var(--global-input-height-m);
  }

  .react-aria-DateInput {
    display: flex;
    padding: var(--date-field-vertical-padding)
      var(--date-field-horizontal-padding);
    border: var(--global-border-size-thin) solid
      var(--global-input-field-border-color);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-input-field-background-color);
    width: fit-content;
    box-sizing: border-box;
    min-width: 150px;
    white-space: nowrap;
    forced-color-adjust: none;

    &[data-focus-within] {
      outline: 1px solid var(--global-color-primary);
      outline-offset: -1px;
    }

    &[data-invalid] {
      border-color: var(--global-color-danger);
    }
  }

  .react-aria-DateSegment {
    padding: 0 2px;
    font-variant-numeric: tabular-nums;
    text-align: end;
    color: var(--global-text-color-900);

    &[data-type="literal"] {
      padding: 0;
    }

    &[data-placeholder] {
      color: var(--text-color-placeholder);
      font-style: italic;
    }

    &:focus {
      color: var(--highlight-foreground);
      background: var(--highlight-background);
      outline: none;
      border-radius: var(--global-rounding-small);
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
      data-size={"S"} // TODO: move to a prop. For now we only support S
      ref={ref}
    />
  );
}

const _DateField = forwardRef(DateField);
export { _DateField as DateField };
