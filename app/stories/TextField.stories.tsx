import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { TextField as LegacyTextField } from "@arizeai/components";

import {
  Flex,
  Input,
  Label,
  Text,
  TextField,
  TextFieldProps,
} from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "TextField",
  component: TextField,

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<TextFieldProps> = (args) => (
  <ThemeWrapper>
    <TextField {...args}>
      <Label>Label</Label>
      <Input type="text" />
      <Text slot="description">Description</Text>
    </TextField>
  </ThemeWrapper>
);

export const Default = Template.bind({});

export const Gallery = () => (
  <ThemeWrapper>
    <Flex direction="row" gap="size-200">
      <TextField>
        <Label>Label</Label>
        <Input type="text" />
      </TextField>
      <TextField isInvalid>
        <Label>Label</Label>
        <Input type="text" />
      </TextField>
    </Flex>
  </ThemeWrapper>
);

export const Migration = () => (
  <ThemeWrapper>
    <Flex direction="row" gap="size-200">
      <TextField>
        <Label>Label</Label>
        <Input type="text" />
      </TextField>
      <LegacyTextField label="Label" />
    </Flex>
  </ThemeWrapper>
);
