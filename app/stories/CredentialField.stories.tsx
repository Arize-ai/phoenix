import type { Meta, StoryFn } from "@storybook/react";

import type { CredentialFieldProps } from "@phoenix/components";
import {
  CredentialField,
  CredentialInput,
  FieldError,
  Flex,
  Label,
  Text,
} from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Credential Field",
  component: CredentialField,
  decorators: [
    (Story) => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    size: {
      control: { type: "radio" },
      options: ["S", "M"],
    },
    copyable: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

const Template: StoryFn<CredentialFieldProps> = (args) => (
  <CredentialField defaultValue="sk-1234567890abcdef" {...args}>
    <Label>API Key</Label>
    <CredentialInput />
    <Text slot="description">Your secret API key</Text>
  </CredentialField>
);

export const Default = Template.bind({});

export const Copyable: StoryFn = () => (
  <CredentialField defaultValue="sk-1234567890abcdef" copyable>
    <Label>API Key</Label>
    <CredentialInput />
    <Text slot="description">Copy without revealing the value</Text>
  </CredentialField>
);

export const WithError: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <CredentialField isInvalid>
      <Label>API Key (empty)</Label>
      <CredentialInput />
      <FieldError>API key is required</FieldError>
    </CredentialField>
    <CredentialField isInvalid defaultValue="invalid-key">
      <Label>API Key (with value)</Label>
      <CredentialInput />
      <FieldError>Invalid API key format</FieldError>
    </CredentialField>
  </Flex>
);

export const ReadOnly: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <CredentialField isReadOnly>
      <Label>API Key (empty, read-only)</Label>
      <CredentialInput />
      <Text slot="description">No value to reveal</Text>
    </CredentialField>
    <CredentialField isReadOnly defaultValue="sk-readonly-key-1234">
      <Label>API Key (with value, read-only)</Label>
      <CredentialInput />
      <Text slot="description">Toggle still works to reveal the value</Text>
    </CredentialField>
    <CredentialField isReadOnly defaultValue="sk-readonly-key-1234" copyable>
      <Label>API Key (read-only + copyable)</Label>
      <CredentialInput />
      <Text slot="description">Reveal and copy are independent actions</Text>
    </CredentialField>
  </Flex>
);

export const Disabled: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <CredentialField isDisabled>
      <Label>API Key (empty, disabled)</Label>
      <CredentialInput />
      <Text slot="description">No value, fully disabled</Text>
    </CredentialField>
    <CredentialField isDisabled defaultValue="sk-disabled-key-5678">
      <Label>API Key (with value, disabled)</Label>
      <CredentialInput />
      <Text slot="description">Has a value, but fully disabled</Text>
    </CredentialField>
    <CredentialField isDisabled defaultValue="sk-disabled-key-5678" copyable>
      <Label>API Key (disabled + copyable)</Label>
      <CredentialInput />
      <Text slot="description">Both buttons are disabled</Text>
    </CredentialField>
  </Flex>
);

export const Required: StoryFn = () => (
  <CredentialField isRequired>
    <Label>Required Secret</Label>
    <CredentialInput />
    <Text slot="description">This field is required</Text>
  </CredentialField>
);

export const Sizes: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <CredentialField size="S" defaultValue="size-s-credential" copyable>
      <Label>Size S</Label>
      <CredentialInput />
    </CredentialField>
    <CredentialField size="M" defaultValue="size-m-credential" copyable>
      <Label>Size M (default)</Label>
      <CredentialInput />
    </CredentialField>
  </Flex>
);

export const Gallery: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <CredentialField defaultValue="sk-1234567890abcdef">
      <Label>Default</Label>
      <CredentialInput />
      <Text slot="description">Show/hide only</Text>
    </CredentialField>

    <CredentialField defaultValue="sk-1234567890abcdef" copyable>
      <Label>With Copy</Label>
      <CredentialInput />
      <Text slot="description">Show/hide + copy</Text>
    </CredentialField>

    <CredentialField>
      <Label>Empty</Label>
      <CredentialInput />
      <Text slot="description">Enter a credential</Text>
    </CredentialField>

    <CredentialField isInvalid defaultValue="wrong-format">
      <Label>Invalid</Label>
      <CredentialInput />
      <FieldError>Token must start with &quot;tok-&quot;</FieldError>
    </CredentialField>

    <CredentialField isReadOnly defaultValue="sk-readonly-key-1234" copyable>
      <Label>Read-Only + Copyable</Label>
      <CredentialInput />
    </CredentialField>

    <CredentialField isDisabled defaultValue="sk-disabled-key-5678" copyable>
      <Label>Disabled + Copyable</Label>
      <CredentialInput />
    </CredentialField>
  </Flex>
);
