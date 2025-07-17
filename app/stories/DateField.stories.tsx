import { Meta, StoryFn } from "@storybook/react";

import {
  DateField,
  DateFieldProps,
  DateInput,
  DateSegment,
  DateValue,
  I18nProvider,
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
 * DateFields are used to type in dates within the UI
 */
export const Default = Template.bind({});

Default.args = {};

export const InternationalizedIndia = () => (
  <I18nProvider locale="hi-IN-u-ca-indian">
    <DateField granularity="hour">
      <Label>Birth date</Label>
      <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
    </DateField>
  </I18nProvider>
);

export const InternationalizedEngliand = () => (
  <I18nProvider locale="en-GB">
    <DateField granularity="hour">
      <Label>Birth date</Label>
      <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
    </DateField>
  </I18nProvider>
);
