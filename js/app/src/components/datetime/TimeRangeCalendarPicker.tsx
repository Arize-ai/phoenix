import { css } from "@emotion/react";
import {
  now,
  Time,
  toCalendarDate,
  toCalendarDateTime,
  toZoned,
} from "@internationalized/date";
import { useState } from "react";
import type { DateValue } from "react-aria-components";
import { DateInput, DateSegment, Label } from "react-aria-components";

import { Button } from "../core/button";
import { Text } from "../core/content";
import { DateField } from "../core/datetime/DateField";
import { RangeCalendar } from "../core/datetime/RangeCalendar";
import { toDateValue } from "./utils";

export type TimeRangeCalendarPickerProps = {
  /** The committed range used to seed the calendar and fields. */
  value: OpenTimeRange;
  /** The time zone the dates are displayed and edited in. */
  timeZone: string;
  /** Called with the chosen range when the user applies it. */
  onApply: (range: { start: Date; end: Date }) => void;
  /** Called when the user backs out without applying a range. */
  onCancel: () => void;
};

const timeRangeCalendarPickerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);

  .time-range-calendar-picker__fields {
    display: grid;
    /* Mirror the two month grids so each field sits squarely under a month. */
    grid-template-columns: 1fr 1fr;
    gap: var(--global-dimension-size-300);
  }

  .time-range-calendar-picker__controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--global-dimension-size-100);
  }

  .time-range-calendar-picker__error {
    margin-right: auto;
  }
`;

/* Fill the grid column instead of the DateField's fit-content default. */
const dateFieldCSS = css`
  .react-aria-DateInput {
    width: 100%;
    min-width: 0;
  }
`;

/** Picking a day on the calendar means the whole day. */
const START_OF_DAY = new Time(0, 0, 0);
const END_OF_DAY = new Time(23, 59, 59);

/**
 * A full calendar range picker with start/end date-time fields. Clicking or
 * dragging across the calendar selects whole days; the fields refine the
 * selection down to the minute. Nothing is committed until Apply is pressed.
 */
export function TimeRangeCalendarPicker(props: TimeRangeCalendarPickerProps) {
  const { value, timeZone, onApply, onCancel } = props;
  const [startValue, setStartValue] = useState<DateValue | null>(() =>
    toDateValue(value.start, timeZone)
  );
  // An open-ended range is seeded with the current time so the calendar and
  // fields always show a complete, editable window.
  const [endValue, setEndValue] = useState<DateValue | null>(
    () => toDateValue(value.end, timeZone) ?? now(timeZone)
  );

  const startDate = startValue ? startValue.toDate(timeZone) : null;
  const endDate = endValue ? endValue.toDate(timeZone) : null;
  const isInvalid = Boolean(startDate && endDate && startDate > endDate);
  const applyRange =
    startDate && endDate && !isInvalid
      ? { start: startDate, end: endDate }
      : null;

  // The calendar works in whole days; a backwards range is withheld so the
  // calendar never renders an invalid selection.
  const calendarValue =
    startValue && endValue && !isInvalid
      ? { start: toCalendarDate(startValue), end: toCalendarDate(endValue) }
      : null;

  return (
    <div
      data-testid="time-range-calendar-picker"
      className="time-range-calendar-picker"
      css={timeRangeCalendarPickerCSS}
    >
      <RangeCalendar
        aria-label="Time range"
        visibleDuration={{ months: 2 }}
        value={calendarValue}
        onChange={(range) => {
          if (!range) {
            return;
          }
          setStartValue(
            toZoned(toCalendarDateTime(range.start, START_OF_DAY), timeZone)
          );
          setEndValue(
            toZoned(toCalendarDateTime(range.end, END_OF_DAY), timeZone)
          );
        }}
      />
      <div className="time-range-calendar-picker__fields">
        <DateField
          granularity="minute"
          hideTimeZone
          value={startValue}
          onChange={setStartValue}
          css={dateFieldCSS}
        >
          <Label>Start</Label>
          <DateInput>
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
        </DateField>
        <DateField
          granularity="minute"
          hideTimeZone
          isInvalid={isInvalid}
          value={endValue}
          onChange={setEndValue}
          css={dateFieldCSS}
        >
          <Label>End</Label>
          <DateInput>
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
        </DateField>
      </div>
      <div className="time-range-calendar-picker__controls">
        {isInvalid && (
          <Text
            size="XS"
            color="danger"
            className="time-range-calendar-picker__error"
          >
            End must be after the start
          </Text>
        )}
        <Button size="S" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          data-testid="time-range-calendar-picker-apply-button"
          size="S"
          variant="primary"
          isDisabled={!applyRange}
          onPress={() => {
            if (applyRange) {
              onApply(applyRange);
            }
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
