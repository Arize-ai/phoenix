import type { Meta, StoryFn } from "@storybook/react";

import type { TimeFieldProps, TimeValue } from "@phoenix/components";
import { DateInput, DateSegment, Label, TimeField } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Time Field",
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

export const Default = {
  render: Template,
  args: {},
};
