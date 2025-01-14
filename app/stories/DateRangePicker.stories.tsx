import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  DateRangePicker,
  DateRangePickerProps,
  DateValue,
} from "@phoenix/components";

const meta: Meta = {
  title: "DateRangePicker",
  component: DateRangePicker,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<DateRangePickerProps<DateValue>> = (args) => (
  <DateRangePicker {...args} />
);

/**
 * Buttons are used to perform actions within the UI
 */
export const Default = Template.bind({});

Default.args = {};
