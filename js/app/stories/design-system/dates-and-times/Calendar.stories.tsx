import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import type { Meta, StoryFn } from "@storybook/react";

import type {
  CalendarProps,
  DateValue,
  RangeCalendarProps,
} from "@phoenix/components";
import { Calendar, RangeCalendar } from "@phoenix/components";

/**
 * Calendar picks a single date from a month grid. `RangeCalendar` is its
 * range counterpart: the same grid, selecting a start and an end date. The
 * `Range…` stories below render it.
 */
const meta: Meta = {
  title: "Design System/Dates and times/Calendar",
  tags: ["legacy", "unreviewed"],
  component: Calendar,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<CalendarProps<DateValue>> = (args) => (
  <Calendar aria-label="Date" {...args} />
);

export const Default = {
  render: Template,
  args: {},
};

export const WithDefaultValue = {
  render: Template,
  args: {
    defaultValue: today(getLocalTimeZone()),
  },
};

export const TwoMonths = {
  render: Template,
  args: {
    visibleDuration: { months: 2 },
  },
};

export const WithMinAndMaxValues = {
  render: Template,
  args: {
    minValue: today(getLocalTimeZone()).subtract({ days: 7 }),
    maxValue: today(getLocalTimeZone()),
  },
};

const RangeTemplate: StoryFn<RangeCalendarProps<DateValue>> = (args) => (
  <RangeCalendar aria-label="Date range" {...args} />
);

export const RangeDefault = {
  render: RangeTemplate,
  args: {},
};

export const RangeWithDefaultValue = {
  render: RangeTemplate,
  args: {
    defaultValue: {
      start: today(getLocalTimeZone()).subtract({ days: 7 }),
      end: today(getLocalTimeZone()),
    },
  },
};

export const RangeTwoMonths = {
  render: RangeTemplate,
  args: {
    visibleDuration: { months: 2 },
    defaultValue: {
      start: today(getLocalTimeZone()).subtract({ days: 20 }),
      end: today(getLocalTimeZone()),
    },
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  // A month grid is taller than the frame at 1:1.
  parameters: { thumbnail: { scale: 0.8 } },
  render: Template,
  // A fixed date, so regenerating the image does not follow the clock.
  args: {
    defaultValue: parseDate("2026-03-24"),
  },
};
