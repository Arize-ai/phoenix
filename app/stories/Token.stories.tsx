import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import { Icon, Icons, Token, type TokenProps } from "@phoenix/components";

const meta: Meta = {
  title: "Token",
  component: Token,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<TokenProps> = (args) => (
  <Card title="Token" bodyStyle={{ width: "600px" }} variant="compact">
    <Token {...args}>Example Token</Token>
  </Card>
);

export const Default: Meta<typeof Token> = {
  render: Template,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const InteractiveTemplate: StoryFn<TokenProps> = (args) => (
  <Card
    title="Interactive Token"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Token {...args} onPress={() => alert("Token clicked!")}>
      Clickable Token
    </Token>
  </Card>
);

export const Interactive: Meta<typeof Token> = {
  render: InteractiveTemplate,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const RemovableTemplate: StoryFn<TokenProps> = (args) => (
  <Card
    title="Removable Token"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Token {...args} onRemove={() => alert("Token removed!")}>
      Removable Token
    </Token>
  </Card>
);

export const Removable: Meta<typeof Token> = {
  render: RemovableTemplate,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const FullInteractiveTemplate: StoryFn<TokenProps> = (args) => (
  <Card
    title="Full Interactive Token"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Token
      {...args}
      onPress={() => alert("Token clicked!")}
      onRemove={() => alert("Token removed!")}
    >
      Interactive & Removable
    </Token>
  </Card>
);

export const FullInteractive: Meta<typeof Token> = {
  render: FullInteractiveTemplate,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const WithIconTemplate: StoryFn<TokenProps> = (args) => (
  <Card
    title="Token with Icon"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <Token {...args}>
      <Icon svg={<Icons.Info />} /> With Icon
    </Token>
  </Card>
);

export const WithIcon: Meta<typeof Token> = {
  render: WithIconTemplate,
  args: {
    isDisabled: false,
    onPress: () => alert("Token clicked!"),
  },
  argTypes: {},
};

const GroupTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Token Group" bodyStyle={{ width: "600px" }} variant="compact">
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Token {...args}>Default Token</Token>
      <Token {...args} color="var(--ac-global-color-primary)">
        Primary Token
      </Token>
      <Token {...args} color="var(--ac-global-color-danger)">
        Danger Token
      </Token>
      <Token {...args} color="var(--ac-global-color-success)">
        Success Token
      </Token>
    </div>
  </Card>
);

export const Group: Meta<typeof Token> = {
  render: GroupTemplate,
  args: {
    isDisabled: false,
    onPress: () => alert("Token clicked!"),
    onRemove: () => alert("Token removed!"),
  },
};
