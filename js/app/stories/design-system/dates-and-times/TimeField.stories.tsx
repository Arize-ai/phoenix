import { Time } from "@internationalized/date";
import type { Meta, StoryFn } from "@storybook/react";

import type { TimeFieldProps, TimeValue } from "@phoenix/components";
import { DateInput, DateSegment, Label, TimeField } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Dates and times/Time Field",
  tags: ["legacy", "unreviewed"],
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  render: Template,
  args: {
    defaultValue: new Time(14, 30),
  },
};
