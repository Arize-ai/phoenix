import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import type { Meta, StoryFn } from "@storybook/react";

import type { DateValue, RangeCalendarProps } from "@phoenix/components";
import { RangeCalendar } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Dates and times/Range Calendar",
  tags: ["legacy", "unreviewed"],
  component: RangeCalendar,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<RangeCalendarProps<DateValue>> = (args) => (
  <RangeCalendar aria-label="Date range" {...args} />
);

export const Default = {
  render: Template,
  args: {},
};

export const WithDefaultValue = {
  render: Template,
  args: {
    defaultValue: {
      start: today(getLocalTimeZone()).subtract({ days: 7 }),
      end: today(getLocalTimeZone()),
    },
  },
};

export const TwoMonths = {
  render: Template,
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
  // A fixed range, so regenerating the image does not follow the clock.
  args: {
    defaultValue: {
      start: parseDate("2026-03-17"),
      end: parseDate("2026-03-24"),
    },
  },
};
