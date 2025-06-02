import { forwardRef, Ref } from "react";
import {
  TimeField as AriaTimeField,
  TimeFieldProps as AriaTimeFieldProps,
  TimeValue,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "../field/styles";

export type TimeFieldProps<T extends TimeValue> = AriaTimeFieldProps<T>;

const timeFieldCSS = css`
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
    min-width: 150px;
    white-space: nowrap;
    forced-color-adjust: none;

    &[data-focus-within] {
      outline: 1px solid var(--ac-global-color-primary);
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

function TimeField<T extends TimeValue>(
  props: TimeFieldProps<T>,
  ref: Ref<HTMLDivElement>
) {
  return (
    <AriaTimeField css={css(fieldBaseCSS, timeFieldCSS)} {...props} ref={ref} />
  );
}

const _TimeField = forwardRef(TimeField);
export { _TimeField as TimeField };
