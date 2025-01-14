import React from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerProps as AriaDateRangePickerProps,
  DateSegment,
  DateValue,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
  RangeCalendar,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  fieldBaseCSS,
  fieldPopoverCSS,
} from "@phoenix/components/field/styles";

const dateRangePickerCSS = css`
  color: var(--ac-global-text-color-900);

  .react-aria-Group {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: fit-content;
    min-width: 20px;
    max-width: 100%;
    box-sizing: border-box;
    overflow: auto;
    position: relative;
    padding: 4px 4px 4px 8px;
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    background: var(--field-background);
    white-space: nowrap;

    &[data-pressed] {
      box-shadow: none;
      background: var(--highlight-background);
    }

    &[data-focus-within] {
      outline: 2px solid var(--ac-global-input-field-border-color-active);
      outline-offset: -1px;
    }
  }

  [slot="start"] + span {
    padding: 0 4px;
  }

  [slot="end"] {
    margin-right: 2rem;
    flex: 1;
  }

  .react-aria-Button {
    background: transparent;
    forced-color-adjust: none;
    border-radius: 4px;
    border: none;
    margin-left: auto;
    width: 1.429rem;
    height: 1.429rem;
    padding: 0;
    box-sizing: content-box;
    flex-shrink: 0;
    position: sticky;
    right: 0;

    &[data-focus-visible] {
      outline: 2px solid var(--ac-global-input-field-border-color-active);
      outline-offset: 2px;
    }

    .react-aria-DateInput {
      width: unset;
      min-width: unset;
      padding: unset;
      border: unset;
      outline: unset;
    }
  }
`;

const popoverCSS = css(fieldPopoverCSS);

export interface DateRangePickerProps<T extends DateValue>
  extends AriaDateRangePickerProps<T> {}

export function DateRangePicker<T extends DateValue>(
  props: DateRangePickerProps<T>
) {
  return (
    <AriaDateRangePicker {...props} css={css(fieldBaseCSS, dateRangePickerCSS)}>
      <Label>Trip dates</Label>
      <Group>
        <DateInput slot="start">
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
        <span aria-hidden="true">–</span>
        <DateInput slot="end">
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
        <Button>▼</Button>
      </Group>
      <Popover css={popoverCSS}>
        <Dialog>
          <RangeCalendar>
            <header>
              <Button slot="previous">◀</Button>
              <Heading />
              <Button slot="next">▶</Button>
            </header>
            <CalendarGrid>
              {(date) => <CalendarCell date={date} />}
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}
