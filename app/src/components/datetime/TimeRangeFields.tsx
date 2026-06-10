import { now, parseAbsolute } from "@internationalized/date";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { useFocusWithin } from "react-aria";
import type { DateValue } from "react-aria-components";
import { DateField, DateInput, DateSegment } from "react-aria-components";

export type TimeRangeFieldsProps = {
  /** Start of the range to seed the start field with. */
  start?: Date | null;
  /**
   * End of the range to seed the end field with. When `null`/omitted the range
   * is open-ended and the end field is seeded with the current time for display.
   */
  end?: Date | null;
  /** The time zone the dates are displayed and edited in. */
  timeZone: string;
  /** Renders the fields read-only. */
  isDisabled?: boolean;
  /** Focuses the start field on mount. */
  autoFocus?: boolean;
  /**
   * Called with the edited range whenever it is committed — on blur, on Enter,
   * or via {@link TimeRangeFieldsHandle.commit}. Only fires when the displayed
   * range has actually been edited, so simply focusing a field does not fork a
   * preset into a custom range.
   */
  onCommit: (range: OpenTimeRange) => void;
  /**
   * Called after focus leaves both fields (the edit is committed first). The
   * owner uses this to decide whether the editing session should end.
   */
  onBlurWithin?: () => void;
  /**
   * Called after Enter commits the current field state, so the owner can close
   * the editing session. Escape and outside interactions are owned by the
   * parent selector, which commits via {@link TimeRangeFieldsHandle.commit}.
   */
  onSubmit?: () => void;
};

/** Imperative handle that lets the owner flush a pending edit. */
export type TimeRangeFieldsHandle = {
  /** Commits the current field values if they have been edited. */
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
  // Whether the user actually edited the end field. An open-ended preset has no
  // end, so we seed "now" only for display; if it is never touched the range
  // remains open-ended instead of committing the (frozen) seed value.
  const isEndDirtyRef = useRef(false);
  const isEndOpen = end == null;
  const [startValue, setStartValue] = useState<DateValue | null>(() =>
    toDateValue(start, timeZone)
  );
  const [endValue, setEndValue] = useState<DateValue | null>(
    () => toDateValue(end, timeZone) ?? now(timeZone)
  );

  const startDate = startValue ? startValue.toDate(timeZone) : null;
  const endDate = endValue ? endValue.toDate(timeZone) : null;
  const isInvalid = Boolean(startDate && endDate && startDate > endDate);

  const reset = useCallback(() => {
    setStartValue(toDateValue(start, timeZone));
    setEndValue(toDateValue(end, timeZone) ?? now(timeZone));
    isDirtyRef.current = false;
    isEndDirtyRef.current = false;
  }, [end, start, timeZone]);

  const commit = useCallback(() => {
    if (!isDirtyRef.current) {
      return;
    }
    // An untouched open-ended end seeds "now" only for display. Keep the end
    // open so relative ranges continue to follow wall-clock time.
    const committedEnd = isEndOpen && !isEndDirtyRef.current ? null : endDate;
    if (startDate && committedEnd && startDate > committedEnd) {
      // Discard an invalid edit rather than committing a backwards range.
      reset();
      return;
    }
    isDirtyRef.current = false;
    onCommit({ start: startDate, end: committedEnd });
  }, [endDate, isEndOpen, onCommit, reset, startDate]);

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
      onKeyDownCapture={(e) => {
        // Enter commits the edit and asks the owner to close. Escape is owned by
        // the parent selector so it behaves the same whether focus is in these
        // fields or in the presets list.
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
          isDirtyRef.current = true;
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
          isDirtyRef.current = true;
          isEndDirtyRef.current = true;
        }}
      >
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
    </div>
  );
}
