import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  DateField,
  DateFieldProps,
  DateInput,
  DateSegment,
  DateValue,
  Label,
} from "@phoenix/components";

const meta: Meta = {
  title: "DateField",
  component: DateField,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<DateFieldProps<DateValue>> = (args) => (
  <DateField {...args}>
    <Label>Birth date</Label>
    <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
  </DateField>
);

/**
 * Buttons are used to perform actions within the UI
 */
export const Default = Template.bind({});

Default.args = {};
