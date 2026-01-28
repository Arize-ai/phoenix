import { Meta, StoryFn } from "@storybook/react";

import {
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
  TextFieldProps,
} from "@phoenix/components";
import { FieldDangerIcon, FieldSuccessIcon } from "@phoenix/components/field";

const meta: Meta = {
  title: "TextField",
  component: TextField,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    size: {
      control: { type: "radio" },
      options: ["S", "M"],
    },
  },
};

export default meta;

const Template: StoryFn<TextFieldProps> = (args) => (
  <TextField {...args}>
    <Label>Label</Label>
    <Input type="text" />
    <Text slot="description">Description</Text>
  </TextField>
);

export const Default = Template.bind({});

export const Gallery = () => (
  <Flex direction="column" gap="size-50" width="600px">
    <TextField>
      <Label>Label</Label>
      <Input type="text" />
    </TextField>
    <TextField>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">Field description</Text>
    </TextField>
    <TextField isInvalid>
      <Label>Label</Label>
      <Input type="text" />
      <FieldDangerIcon />
      <FieldError>Field error</FieldError>
    </TextField>
    <TextField>
      <Label>Label</Label>
      <Input type="text" />
      <FieldSuccessIcon />
      <Text slot="description">Field success</Text>
    </TextField>
    <TextField isReadOnly>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">This is read only</Text>
    </TextField>
  </Flex>
);
