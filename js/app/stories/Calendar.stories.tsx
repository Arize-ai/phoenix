import { getLocalTimeZone, today } from "@internationalized/date";
import type { Meta, StoryFn } from "@storybook/react";

import type { CalendarProps, DateValue } from "@phoenix/components";
import { Calendar } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Calendar",
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
