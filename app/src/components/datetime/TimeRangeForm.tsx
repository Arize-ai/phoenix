import { useCallback } from "react";
import {
  DateInput,
  DateSegment,
  DateValue,
  FieldError,
  Form,
  Label,
} from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import { getLocalTimeZone, parseAbsolute } from "@internationalized/date";
import { css } from "@emotion/react";

import { Button } from "../button";
import { Icon, Icons } from "../icon";

import { DateField } from "./DateField";

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
`;

const formRowCSS = css`
  display: flex;
  gap: var(--ac-global-dimension-size-100);
  align-items: start;
  justify-content: end;
  /* Move the button down to align */
  button {
    margin-top: 26px;
  }
`;

const controlsRowCSS = css`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: var(--ac-global-dimension-size-100);
`;

const dateFieldCSS = css`
  width: 100%;
  .react-aria-DateInput {
    width: 100%;
    // Eliminate the re-sizing of the DateField as you type
    min-width: 200px;
  }
`;

type TimeRangeFormParams = {
  startDate: DateValue | null;
  endDate: DateValue | null;
};

export type TimeRangeFormProps = {
  initialValue?: OpenTimeRange;
  /**
   * Called when the form is submitted.
   */
  onSubmit: (data: OpenTimeRange) => void;
  /**
   * The time zone to use for the date and time pickers.
   * Defaults to the user's time zone.
   */
  timeZone?: string;
};

function timeRangeToFormParams(
  timeRange: OpenTimeRange,
  timeZone: string
): TimeRangeFormParams {
  return {
    startDate: timeRange.start
      ? parseAbsolute(timeRange.start.toISOString(), timeZone)
      : null,
    endDate: timeRange.end
      ? parseAbsolute(timeRange.end.toISOString(), timeZone)
      : null,
  };
}

/**
 * A form that displays a date and time picker.
 */
export function TimeRangeForm(props: TimeRangeFormProps) {
  const {
    initialValue,
    onSubmit: propsOnSubmit,
    timeZone = getLocalTimeZone(),
  } = props;
  const {
    control,
    handleSubmit,
    formState: { isValid },
    resetField,
    setError,
    clearErrors,
  } = useForm<TimeRangeFormParams>({
    defaultValues: timeRangeToFormParams(initialValue || {}, timeZone),
  });

  const onStartClear = useCallback(() => {
    resetField("startDate", { defaultValue: null });
  }, [resetField]);

  const onEndClear = useCallback(() => {
    resetField("endDate", { defaultValue: null });
  }, [resetField]);

  const onSubmit = useCallback(
    (data: TimeRangeFormParams) => {
      clearErrors();
      const { startDate, endDate } = data;
      const start = startDate ? startDate.toDate(timeZone) : null;
      const end = endDate ? endDate.toDate(timeZone) : null;
      if (start && end && start > end) {
        setError("endDate", {
          message: "End must be after the start date",
        });
        return;
      }
      propsOnSubmit({ start, end });
    },
    [propsOnSubmit, setError, clearErrors, timeZone]
  );
  return (
    <Form
      css={containerCSS}
      data-testid="time-range-form"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div data-testid="start-time" css={formRowCSS}>
        <Controller
          name="startDate"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid },
          }) => (
            <DateField
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value}
              granularity="second"
              hideTimeZone
              css={dateFieldCSS}
            >
              <Label>Start Date</Label>
              <DateInput>
                {(segment) => <DateSegment segment={segment} />}
              </DateInput>
            </DateField>
          )}
        />
        <Button
          size="S"
          excludeFromTabOrder
          onPress={onStartClear}
          aria-label="Clear start date and time"
          leadingVisual={<Icon svg={<Icons.Refresh />} />}
        />
      </div>
      <div data-testid="end-time" css={formRowCSS}>
        <Controller
          name="endDate"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => {
            return (
              <DateField
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value}
                granularity="second"
                hideTimeZone
                css={dateFieldCSS}
              >
                <Label>End Date</Label>
                <DateInput>
                  {(segment) => <DateSegment segment={segment} />}
                </DateInput>
                {error ? <FieldError>{error.message}</FieldError> : null}
              </DateField>
            );
          }}
        />
        <Button
          size="S"
          excludeFromTabOrder
          onPress={onEndClear}
          aria-label="Clear end date and time"
          leadingVisual={<Icon svg={<Icons.Refresh />} />}
        />
      </div>
      <div data-testid="controls" css={controlsRowCSS}>
        <Button isDisabled={!isValid} size="S" type="submit" variant="primary">
          Apply
        </Button>
      </div>
    </Form>
  );
}
