import { Meta, StoryFn } from "@storybook/react";

import {
  DateInput,
  DateSegment,
  Label,
  TimeField,
  TimeFieldProps,
  TimeValue,
} from "@phoenix/components";

const meta: Meta = {
  title: "TimeField",
  component: TimeField,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<TimeFieldProps<TimeValue>> = (args) => (
  <TimeField {...args}>
    <Label>Event time</Label>
    <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
  </TimeField>
);

/**
 * DateFields are used to type in dates within the UI
 */
export const Default = Template.bind({});

Default.args = {};
