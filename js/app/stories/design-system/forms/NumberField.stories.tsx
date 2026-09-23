import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { NumberFieldProps } from "@phoenix/components";
import {
  FieldError,
  Flex,
  Input,
  Label,
  NumberField,
  Text,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Forms/Number Field",
  tags: ["legacy", "unreviewed"],
  component: NumberField,

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<NumberFieldProps> = (args) => (
  <NumberField {...args}>
    <Label>Label</Label>
    <Input type="text" />
    <Text slot="description">Description</Text>
  </NumberField>
);

export const Default = {
  render: Template,
};

export const Gallery = () => (
  <Flex direction="column" gap="size-50" width="600px">
    <NumberField defaultValue={42}>
      <Label>Label</Label>
      <Input type="text" />
    </NumberField>
    <NumberField defaultValue={42}>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">Field description</Text>
    </NumberField>
    <NumberField isInvalid defaultValue={42}>
      <Label>Label</Label>
      <Input type="text" />
      <FieldError>Field error</FieldError>
    </NumberField>
    <NumberField isReadOnly defaultValue={42}>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">This is read only</Text>
    </NumberField>
  </Flex>
);

export const Formatting = () => (
  <View width="300px">
    <NumberField
      defaultValue={0}
      formatOptions={{
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }}
    >
      <Label>Cost per 1M tokens</Label>
      <Input />
    </NumberField>
  </View>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<NumberFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <NumberField
      defaultValue={2.5}
      formatOptions={{
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }}
    >
      <Label>Cost per 1M tokens</Label>
      <Input />
    </NumberField>
  ),
};
