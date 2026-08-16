import { css } from "@emotion/react";
import type { Ref } from "react";
import type {
  CalendarProps as AriaCalendarProps,
  DateValue,
} from "react-aria-components";
import { Calendar as AriaCalendar } from "react-aria-components";

import type { StylableProps } from "../types";
import { CalendarContent } from "./CalendarContent";
import { calendarCSS } from "./calendarStyles";

export interface CalendarProps<T extends DateValue>
  extends AriaCalendarProps<T>, StylableProps {
  /** An error message to display when the selection is invalid. */
  errorMessage?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A calendar for picking a single date. Renders one month per
 * `visibleDuration` month with shared navigation. Pass children to fully
 * customize the composition.
 */
function Calendar<T extends DateValue>(props: CalendarProps<T>) {
  const { errorMessage, css: propsCSS, children, ref, ...restProps } = props;
  const months = props.visibleDuration?.months || 1;
  return (
    <AriaCalendar ref={ref} css={css(calendarCSS, propsCSS)} {...restProps}>
      {children ?? (
        <CalendarContent months={months} errorMessage={errorMessage} />
      )}
    </AriaCalendar>
  );
}

export { Calendar };
