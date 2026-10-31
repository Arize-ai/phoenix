import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { CredentialFieldProps } from "@phoenix/components";
import {
  CredentialField,
  CredentialInput,
  FieldError,
  Flex,
  Label,
  Text,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Credential Field",
  tags: ["updated", "unreviewed", "incomplete"],
  component: CredentialField,

  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
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

export const Default: StoryFn = () => (
  <View width="320px">
    <CredentialField isRequired defaultValue="sk-proj-4f8b2c1d9e7a6b5c3d2e1f0a">
      <Label>OPENAI_API_KEY</Label>
      <CredentialInput />
    </CredentialField>
  </View>
);
Default.tags = ["!dev"];

/*
 * Values go on `CredentialField`, never on `CredentialInput`: the field is a
 * React Aria TextField that owns the input's value, so an input-level
 * `defaultValue` is ignored and the input renders empty.
 */

const STATES: {
  label: string;
  props: Partial<CredentialFieldProps>;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "populated", props: { defaultValue: "sk-1234567890abcdef" } },
  {
    label: "read only",
    props: { isReadOnly: true, value: "sk-prod-5f8a2c1b0e4d9a7c6b3f" },
  },
  {
    label: "disabled",
    props: { isDisabled: true, defaultValue: "sk-1234567890abcdef" },
  },
  {
    label: "error",
    props: { isInvalid: true, defaultValue: "wrong-format" },
    error: 'Token must start with "tok-"',
  },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

/** Wide enough for a key and the visibility toggle, not the whole canvas. */
const FIELD_WIDTH = "220px";

export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth={FIELD_WIDTH}
    alignRows="start"
    renderCell={(state, size) => (
      <CredentialField size={size?.size} {...state.props}>
        <Label>API Key</Label>
        <CredentialInput />
        {state.error ? <FieldError>{state.error}</FieldError> : null}
      </CredentialField>
    )}
  />
);
StatesAndSizes.tags = ["!dev"];

export const ExampleUsage: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="320px">
    <CredentialField isRequired defaultValue="sk-proj-4f8b2c1d9e7a6b5c3d2e1f0a">
      <Label>OPENAI_API_KEY</Label>
      <CredentialInput />
    </CredentialField>

    <CredentialField isRequired>
      <Label>ANTHROPIC_API_KEY</Label>
      <CredentialInput />
    </CredentialField>

    <CredentialField isRequired isInvalid>
      <Label>GEMINI_API_KEY</Label>
      <CredentialInput />
      <FieldError>GEMINI_API_KEY is required</FieldError>
    </CredentialField>

    <Flex direction="column" gap="size-100">
      <CredentialField isRequired defaultValue="AKIAIOSFODNN7EXAMPLE">
        <Label>AWS_ACCESS_KEY_ID</Label>
        <CredentialInput />
      </CredentialField>
      <CredentialField
        isRequired
        defaultValue="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
      >
        <Label>AWS_SECRET_ACCESS_KEY</Label>
        <CredentialInput />
      </CredentialField>
    </Flex>

    <CredentialField>
      <Label>Personal access token</Label>
      <CredentialInput placeholder="github_pat_..." />
    </CredentialField>
  </Flex>
);
ExampleUsage.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<CredentialFieldProps> = {
  tags: ["!dev", "!autodocs"],
  // The value goes on the field: the field's state overrides the input's.
  render: () => (
    <CredentialField defaultValue="sk-1234567890abcdef">
      <Label>API Key</Label>
      <CredentialInput />
      <Text slot="description">Your secret API key</Text>
    </CredentialField>
  ),
};
