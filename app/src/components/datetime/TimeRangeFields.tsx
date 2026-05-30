import { now, parseAbsolute } from "@internationalized/date";
import { useState } from "react";
import { useFocusWithin } from "react-aria";
import type { DateValue } from "react-aria-components";
import { DateField, DateInput, DateSegment } from "react-aria-components";

export type TimeRangeFieldsProps = {
  start?: Date | null;
  end?: Date | null;
  /**
   * The time zone the dates are displayed and edited in.
   */
  timeZone: string;
  isDisabled?: boolean;
  /**
   * Called when the user edits the range and commits the change (on blur or
   * when pressing Enter). Only fires when the displayed range has actually
   * been edited, so simply focusing the field does not fork a preset into a
   * custom range.
   */
  onCommit: (range: OpenTimeRange) => void;
};

function toDateValue(
  date: Date | null | undefined,
  timeZone: string
): DateValue | null {
  return date ? parseAbsolute(date.toISOString(), timeZone) : null;
}

/**
 * Inline, editable start/end date inputs used inside the time range selector.
 *
 * Presets are open-ended (no end), so we seed the end with the current time —
 * the field then reads naturally as "start – now". Typing into either side
 * forks the current window into a custom range without an extra step.
 */
export function TimeRangeFields({
  start,
  end,
  timeZone,
  isDisabled,
  onCommit,
}: TimeRangeFieldsProps) {
  const [startValue, setStartValue] = useState<DateValue | null>(() =>
    toDateValue(start, timeZone)
  );
  const [endValue, setEndValue] = useState<DateValue | null>(
    () => toDateValue(end, timeZone) ?? now(timeZone)
  );
  const [isDirty, setIsDirty] = useState(false);

  const startDate = startValue ? startValue.toDate(timeZone) : null;
  const endDate = endValue ? endValue.toDate(timeZone) : null;
  const isInvalid = Boolean(startDate && endDate && startDate > endDate);

  const reset = () => {
    setStartValue(toDateValue(start, timeZone));
    setEndValue(toDateValue(end, timeZone) ?? now(timeZone));
    setIsDirty(false);
  };

  const commit = () => {
    if (!isDirty) {
      return;
    }
    if (isInvalid) {
      // Discard an invalid edit rather than committing a backwards range.
      reset();
      return;
    }
    onCommit({ start: startDate, end: endDate });
  };

  const { focusWithinProps } = useFocusWithin({ onBlurWithin: commit });

  return (
    <div
      className="time-range-selector__fields"
      data-invalid={isInvalid || undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      {...focusWithinProps}
    >
      <DateField
        aria-label="Start time"
        className="time-range-selector__field"
        granularity="minute"
        hideTimeZone
        isDisabled={isDisabled}
        value={startValue}
        onChange={(value) => {
          setStartValue(value);
          setIsDirty(true);
        }}
      >
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
      <span aria-hidden className="time-range-selector__separator">
        –
      </span>
      <DateField
        aria-label="End time"
        className="time-range-selector__field"
        granularity="minute"
        hideTimeZone
        isDisabled={isDisabled}
        value={endValue}
        onChange={(value) => {
          setEndValue(value);
          setIsDirty(true);
        }}
      >
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
    </div>
  );
}
