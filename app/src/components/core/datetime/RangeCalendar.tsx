import { css } from "@emotion/react";
import type { Ref } from "react";
import type {
  RangeCalendarProps as AriaRangeCalendarProps,
  DateValue,
} from "react-aria-components";
import { RangeCalendar as AriaRangeCalendar } from "react-aria-components";

import type { StylableProps } from "../types";
import { CalendarContent } from "./CalendarContent";
import { calendarCSS, rangeCalendarCSS } from "./calendarStyles";

export interface RangeCalendarProps<DateValueType extends DateValue>
  extends AriaRangeCalendarProps<DateValueType>, StylableProps {
  /** An error message to display when the selection is invalid. */
  errorMessage?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A calendar for picking a contiguous date range — click a start date and
 * click (or drag to) an end date. Renders one month per `visibleDuration`
 * month with shared navigation. Pass children to fully customize the
 * composition.
 */
function RangeCalendar<DateValueType extends DateValue>(
  props: RangeCalendarProps<DateValueType>
) {
  const { errorMessage, css: propsCSS, children, ref, ...restProps } = props;
  const months = props.visibleDuration?.months || 1;
  return (
    <AriaRangeCalendar
      ref={ref}
      css={css(calendarCSS, rangeCalendarCSS, propsCSS)}
      {...restProps}
    >
      {children ?? (
        <CalendarContent months={months} errorMessage={errorMessage} />
      )}
    </AriaRangeCalendar>
  );
}

export { RangeCalendar };
