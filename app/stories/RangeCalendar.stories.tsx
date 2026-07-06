import { getLocalTimeZone, today } from "@internationalized/date";
import type { Meta, StoryFn } from "@storybook/react";

import type { DateValue, RangeCalendarProps } from "@phoenix/components";
import { RangeCalendar } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Range Calendar",
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
