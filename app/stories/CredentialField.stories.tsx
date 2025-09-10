import { Meta, StoryFn } from "@storybook/react";

import {
  CredentialField,
  CredentialFieldProps,
  CredentialInput,
  FieldError,
  Flex,
  Label,
  Text,
} from "@phoenix/components";

const meta: Meta = {
  title: "CredentialField",
  component: CredentialField,

  parameters: {
    controls: { expanded: true },
    docs: {
      description: {
        component: `
A specialized text field for entering sensitive information like passwords, API keys, and tokens.
Features a toggle button to show/hide the credential value.

## Usage

The CredentialField component extends TextField with visibility toggle functionality.
It uses CredentialContext internally to manage the visibility state.
When used with CredentialInput, the toggle button is automatically included.

### Basic Usage
\`\`\`tsx
<CredentialField>
  <Label>API Key</Label>
  <CredentialInput />
  <Text slot="description">Your secret API key</Text>
</CredentialField>
\`\`\`

### With Regular Input
You can also use a regular Input if you don't need the visibility toggle:
\`\`\`tsx
<CredentialField>
  <Label>Field Label</Label>
  <Input type="text" />
</CredentialField>
\`\`\`

Note: When using regular Input, no toggle button will be shown.
        `,
      },
    },
  },
};

export default meta;

const Template: StoryFn<CredentialFieldProps> = (args) => (
  <CredentialField {...args}>
    <Label>API Key</Label>
    <CredentialInput defaultValue="sk-1234567890abcdef" />
    <Text slot="description">Your secret API key</Text>
  </CredentialField>
);

export const Default = Template.bind({});
Default.args = {};

export const Empty = Template.bind({});
Empty.args = {};

export const WithError: StoryFn = () => (
  <CredentialField isInvalid>
    <Label>API Key</Label>
    <CredentialInput defaultValue="invalid-key" />
    <FieldError>Invalid API key format</FieldError>
  </CredentialField>
);

export const ReadOnly: StoryFn = () => (
  <CredentialField isReadOnly>
    <Label>API Key</Label>
    <CredentialInput defaultValue="sk-readonly-key-1234" />
    <Text slot="description">This key is read-only</Text>
  </CredentialField>
);

export const Disabled: StoryFn = () => (
  <CredentialField isDisabled>
    <Label>API Key</Label>
    <CredentialInput defaultValue="sk-disabled-key-5678" />
    <Text slot="description">This field is disabled</Text>
  </CredentialField>
);

export const Gallery: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CredentialField>
      <Label>API Key</Label>
      <CredentialInput defaultValue="sk-1234567890abcdef" />
      <Text slot="description">Click the eye icon to show/hide</Text>
    </CredentialField>

    <CredentialField>
      <Label>Database Password</Label>
      <CredentialInput />
      <Text slot="description">Enter your database password</Text>
    </CredentialField>

    <CredentialField isInvalid>
      <Label>Secret Token</Label>
      <CredentialInput defaultValue="wrong-format" />
      <FieldError>Token must start with &quot;tok-&quot;</FieldError>
    </CredentialField>

    <CredentialField isRequired>
      <Label>Required Secret</Label>
      <CredentialInput />
      <Text slot="description">This field is required</Text>
    </CredentialField>

    <CredentialField size="S">
      <Label>Small Credential Field</Label>
      <CredentialInput defaultValue="small-secret" />
    </CredentialField>

    <CredentialField size="L">
      <Label>Large Credential Field</Label>
      <CredentialInput defaultValue="large-secret-value" />
    </CredentialField>
  </Flex>
);

export const DifferentSizes: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CredentialField size="S">
      <Label>Size S</Label>
      <CredentialInput defaultValue="size-s-credential" />
    </CredentialField>
    <CredentialField size="M">
      <Label>Size M (default)</Label>
      <CredentialInput defaultValue="size-m-credential" />
    </CredentialField>
  </Flex>
);
