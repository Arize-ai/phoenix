import { Meta, StoryFn } from "@storybook/react";

import { Counter, CounterProps } from "@phoenix/components";
const meta: Meta = {
  title: "Counter",
  component: Counter,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<CounterProps> = (args) => <Counter {...args} />;

/**
 * Counters are used to perform actions within the UI
 */
export const Default = Template.bind({});

Default.args = {
  children: "9",
};

/**
 * Use the `variant` prop to change the appearance of the Counter
 */
export const Danger = Template.bind({});

Danger.args = {
  children: "12,000",
  variant: "danger",
};
