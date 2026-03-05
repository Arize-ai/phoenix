import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type {
  TimeFieldProps as AriaTimeFieldProps,
  TimeValue,
} from "react-aria-components";
import { TimeField as AriaTimeField } from "react-aria-components";

import { fieldBaseCSS } from "../field/styles";

export type TimeFieldProps<T extends TimeValue> = AriaTimeFieldProps<T>;

const timeFieldCSS = css`
  --date-field-vertical-padding: 6px;
  --date-field-horizontal-padding: 8px;
  color: var(--global-text-color-900);

  .react-aria-DateInput {
    display: flex;
    padding: var(--date-field-vertical-padding)
      var(--date-field-horizontal-padding);
    border: var(--global-border-size-thin) solid
      var(--global-input-field-border-color);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-input-field-background-color);
    width: fit-content;
    min-width: 150px;
    white-space: nowrap;
    forced-color-adjust: none;

    &[data-focus-within] {
      outline: 1px solid var(--global-color-primary);
      outline-offset: -1px;
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
