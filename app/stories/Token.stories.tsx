import { Meta, StoryFn } from "@storybook/react";

import {
  Card,
  Flex,
  Icon,
  Icons,
  Token,
  type TokenProps,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Token",
  component: Token,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<TokenProps> = (args) => (
  <Card title="Token">
    <View width="600px" padding="size-200">
      <Token {...args}>Example Token</Token>
    </View>
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
  <Card title="Interactive Token">
    <View width="600px" padding="size-200">
      <Token {...args} onPress={() => alert("Token clicked!")}>
        Clickable Token
      </Token>
    </View>
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
  <Card title="Removable Token">
    <View width="600px" padding="size-200">
      <Token {...args} onRemove={() => alert("Token removed!")}>
        Removable Token
      </Token>
    </View>
  </Card>
);

export const Removable: Meta<typeof Token> = {
  render: RemovableTemplate,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const WithLeadingVisualTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Token with Leading Visual">
    <View width="600px" padding="size-200">
      <Token {...args} leadingVisual={<Icon svg={<Icons.Info />} />}>
        With Leading Visual
      </Token>
    </View>
  </Card>
);

export const WithLeadingVisual: Meta<typeof Token> = {
  render: WithLeadingVisualTemplate,
  args: {
    isDisabled: false,
    onPress: () => alert("Token clicked!"),
  },
  argTypes: {},
};

const FullInteractiveTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Full Interactive Token">
    <View width="600px" padding="size-200">
      <Token
        {...args}
        leadingVisual={<Icon svg={<Icons.Info />} />}
        onPress={() => alert("Token clicked!")}
        onRemove={() => alert("Token removed!")}
      >
        Interactive & Removable
      </Token>
    </View>
  </Card>
);

export const FullInteractive: Meta<typeof Token> = {
  render: FullInteractiveTemplate,
  args: {
    isDisabled: false,
  },
  argTypes: {},
};

const SizeTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Token Size">
    <View width="600px" padding="size-200">
      <Flex gap="size-100" wrap>
        <Token {...args} size="S" color="var(--ac-global-color-primary)">
          Small Token
        </Token>
        <Token {...args} size="M" color="var(--ac-global-color-primary)">
          Medium Token
        </Token>
        <Token {...args} size="L" color="var(--ac-global-color-primary)">
          Large Token
        </Token>
      </Flex>
    </View>
  </Card>
);

export const Size: Meta<typeof Token> = {
  render: SizeTemplate,
  args: {
    isDisabled: false,
  },
};

const GroupTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Token Group">
    <View width="600px" padding="size-200">
      <Flex gap="size-100" wrap>
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
      </Flex>
    </View>
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

const TruncatedTemplate: StoryFn<TokenProps> = (args) => (
  <Card title="Token Truncation (hover for full text)">
    <View width="600px" padding="size-200">
      <Flex gap="size-100" direction="column" alignItems="start">
        <Token {...args}>
          Default truncates at 160px - this long text will be cut off
        </Token>
        <Token {...args} maxWidth="100px">
          Custom maxWidth="100px" for narrower spaces
        </Token>
        <Token
          {...args}
          maxWidth="300px"
          color="var(--ac-global-color-primary)"
        >
          Custom maxWidth="300px" allows more text before truncation happens
        </Token>
        <Token {...args} maxWidth="none">
          maxWidth="none" is technically possible but unwise to use because it
          enables unreasonable behavior and some very wide noodles.
        </Token>
      </Flex>
    </View>
  </Card>
);

/**
 * Tokens have a default max-width of 160px and truncate with an ellipsis.
 * Use the `maxWidth` prop to customize the truncation point.
 */
export const Truncated: Meta<typeof Token> = {
  render: TruncatedTemplate,
  args: {
    isDisabled: false,
  },
};
