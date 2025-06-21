import { Meta, StoryFn } from "@storybook/react";

import {
  FieldError,
  Flex,
  Input,
  Label,
  NumberField,
  NumberFieldProps,
  Text,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "NumberField",
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

export const Default = Template.bind({});

export const Gallery = () => (
  <Flex direction="column" gap="size-50" width="600px">
    <NumberField>
      <Label>Label</Label>
      <Input type="text" />
    </NumberField>
    <NumberField>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">Field description</Text>
    </NumberField>
    <NumberField isInvalid>
      <Label>Label</Label>
      <Input type="text" />
      <FieldError>Field error</FieldError>
    </NumberField>
    <NumberField isReadOnly>
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
