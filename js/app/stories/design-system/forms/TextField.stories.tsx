import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TextFieldProps } from "@phoenix/components";
import {
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
} from "@phoenix/components";
import {
  FieldDangerIcon,
  FieldSuccessIcon,
} from "@phoenix/components/core/field";

const meta: Meta = {
  title: "Design System/Forms/Text Field",
  tags: ["legacy", "unreviewed"],
  component: TextField,
  parameters: {
    controls: { expanded: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=32-95",
    },
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

export const Default = {
  render: Template,
};

export const Gallery = () => (
  <Flex direction="column" gap="size-50" width="600px">
    <TextField defaultValue="Example text">
      <Label>Label</Label>
      <Input type="text" />
    </TextField>
    <TextField defaultValue="Example text">
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
    <TextField defaultValue="Example text">
      <Label>Label</Label>
      <Input type="text" />
      <FieldSuccessIcon />
      <Text slot="description">Field success</Text>
    </TextField>
    <TextField isReadOnly defaultValue="Example text">
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">This is read only</Text>
    </TextField>
  </Flex>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<TextFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <TextField defaultValue="Example text">
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">Field description</Text>
    </TextField>
  ),
};
