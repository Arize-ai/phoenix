import type { Meta, StoryFn } from "@storybook/react";

import type { DateFieldProps, DateValue } from "@phoenix/components";
import {
  DateField,
  DateInput,
  DateSegment,
  I18nProvider,
  Label,
} from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Date Field",
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

export const Default = {
  render: Template,
  args: {},
};

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
