import { now, parseAbsolute } from "@internationalized/date";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
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
  autoFocus?: boolean;
  onBlurWithin?: () => void;
  /**
   * Called after Enter commits the current field state.
   */
  onSubmit?: () => void;
};

export type TimeRangeFieldsHandle = {
  commit: () => void;
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
  autoFocus,
  onBlurWithin,
  onSubmit,
  ref,
}: TimeRangeFieldsProps & { ref?: Ref<TimeRangeFieldsHandle> }) {
  const isDirtyRef = useRef(false);
  const [startValue, setStartValue] = useState<DateValue | null>(() =>
    toDateValue(start, timeZone)
  );
  const [endValue, setEndValue] = useState<DateValue | null>(
    () => toDateValue(end, timeZone) ?? now(timeZone)
  );

  const startDate = startValue ? startValue.toDate(timeZone) : null;
  const endDate = endValue ? endValue.toDate(timeZone) : null;
  const isInvalid = Boolean(startDate && endDate && startDate > endDate);

  const markDirty = () => {
    isDirtyRef.current = true;
  };

  const reset = useCallback(() => {
    setStartValue(toDateValue(start, timeZone));
    setEndValue(toDateValue(end, timeZone) ?? now(timeZone));
    isDirtyRef.current = false;
  }, [end, start, timeZone]);

  const commit = useCallback(() => {
    if (!isDirtyRef.current) {
      return;
    }
    if (isInvalid) {
      // Discard an invalid edit rather than committing a backwards range.
      reset();
      return;
    }
    isDirtyRef.current = false;
    onCommit({ start: startDate, end: endDate });
  }, [endDate, isInvalid, onCommit, reset, startDate]);

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  const { focusWithinProps } = useFocusWithin({
    onBlurWithin: () => {
      commit();
      onBlurWithin?.();
    },
  });

  return (
    <div
      className="time-range-selector__fields"
      data-invalid={isInvalid || undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          onSubmit?.();
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
        autoFocus={autoFocus}
        value={startValue}
        onChange={(value) => {
          setStartValue(value);
          markDirty();
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
          markDirty();
        }}
      >
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
    </div>
  );
}
