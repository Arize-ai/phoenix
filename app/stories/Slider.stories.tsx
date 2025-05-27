import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import { Slider, SliderNumberField } from "@phoenix/components";

const meta: Meta<typeof Slider> = {
  title: "Slider",
  component: Slider,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<typeof Slider> = (args) => (
  <Card title="Slider" bodyStyle={{ width: "600px" }} variant="compact">
    <Slider {...args} />
  </Card>
);

export const Default = {
  render: Template,
  args: {
    label: "Default Slider",
    defaultValue: 50,
    minValue: 0,
    maxValue: 100,
  },
};

const WithNumberFieldTemplate: StoryFn<typeof Slider> = (args) => (
  <Card
    title="Slider with Number Field"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Slider {...args}>
      <SliderNumberField />
    </Slider>
  </Card>
);

export const WithNumberField = {
  render: WithNumberFieldTemplate,
  args: {
    label: "Slider with Number Field",
    defaultValue: 50,
    minValue: 0,
    maxValue: 100,
  },
};

const SteppedSliderTemplate: StoryFn<typeof Slider> = (args) => (
  <Card title="Stepped Slider" bodyStyle={{ width: "600px" }} variant="compact">
    <Slider {...args}>
      <SliderNumberField />
    </Slider>
  </Card>
);

export const SteppedSlider = {
  render: SteppedSliderTemplate,
  args: {
    label: "Stepped Slider",
    defaultValue: 0,
    minValue: 0,
    maxValue: 10,
    step: 2,
  },
};

const FloatingPointTemplate: StoryFn<typeof Slider> = (args) => (
  <Card
    title="Floating Point Slider"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Slider {...args}>
      <SliderNumberField />
    </Slider>
  </Card>
);

export const FloatingPoint = {
  render: FloatingPointTemplate,
  args: {
    label: "Floating Point Slider",
    defaultValue: 0.5,
    minValue: 0,
    maxValue: 1,
    step: 0.1,
  },
};

const MultiThumbTemplate: StoryFn<typeof Slider> = (args) => (
  <Card
    title="Multi-Thumb Slider"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Slider {...args} />
  </Card>
);

export const MultiThumb = {
  render: MultiThumbTemplate,
  args: {
    label: "Multi-Thumb Slider",
    defaultValue: [25, 75],
    minValue: 0,
    maxValue: 100,
    thumbLabels: ["Start", "End"],
  },
};

const ControlledTemplate: StoryFn<typeof Slider> = (args) => {
  const [value, setValue] = useState<number>(50);
  return (
    <Card
      title="Controlled Slider"
      bodyStyle={{ width: "600px" }}
      variant="compact"
    >
      <Slider {...args} value={value} onChange={(v) => setValue(v as number)}>
        <SliderNumberField />
      </Slider>
    </Card>
  );
};

export const Controlled = {
  render: ControlledTemplate,
  args: {
    label: "Controlled Slider",
    minValue: 0,
    maxValue: 100,
  },
};
