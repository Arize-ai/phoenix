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

const meta: Meta = {
  title: "TextField",
  component: TextField,

  parameters: {
    controls: { expanded: true },
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
      <FieldError>Field error</FieldError>
    </TextField>
    <TextField isReadOnly>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">This is read only</Text>
    </TextField>
  </Flex>
);
