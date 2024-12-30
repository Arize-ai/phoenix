import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { TextField as LegacyTextField } from "@arizeai/components";

import {
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
  TextFieldProps,
  View,
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
    </Flex>
  </ThemeWrapper>
);

export const Migration = () => (
  <ThemeWrapper>
    <View width="600px">
      <Flex direction="row" gap="size-200" alignItems="center">
        <TextField size="L">
          <Label>Label</Label>
          <Input type="text" />
        </TextField>
        <LegacyTextField label="Label" />
      </Flex>
      <Flex direction="row" gap="size-200">
        <TextField size="L">
          <Label>Label</Label>
          <Input type="text" placeholder="hello" />
        </TextField>
        <LegacyTextField label="Label" placeholder="hello world" />
      </Flex>
    </View>
  </ThemeWrapper>
);
