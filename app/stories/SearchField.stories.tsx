import { Meta, StoryFn } from "@storybook/react";
import { fn } from "@storybook/test";

import {
  FieldError,
  Flex,
  Input,
  Label,
  SearchField,
  SearchFieldProps,
  Text,
} from "@phoenix/components";

const meta: Meta = {
  title: "SearchField",
  component: SearchField,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    size: {
      control: { type: "radio" },
      options: ["S", "M"],
    },
    isDisabled: {
      control: { type: "boolean" },
    },
    isReadOnly: {
      control: { type: "boolean" },
    },
    isRequired: {
      control: { type: "boolean" },
    },
    isInvalid: {
      control: { type: "boolean" },
    },
    showIcon: {
      control: { type: "boolean" },
    },
    variant: {
      control: { type: "radio" },
      options: ["default", "quiet"],
    },
  },
  args: {
    onSubmit: fn(),
    onChange: fn(),
    onClear: fn(),
    showIcon: true,
  },
};

export default meta;

/**
 * Basic SearchField with label and input.
 * The search icon is shown by default.
 */
const Template: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args}>
    <Label>Search</Label>
    <Input placeholder="Type to search..." />
  </SearchField>
);

export const Default = Template.bind({});

/**
 * SearchField without the search icon
 */
export const WithoutIcon: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args} showIcon={false}>
    <Label>Search without Icon</Label>
    <Input placeholder="Search..." />
  </SearchField>
);

/**
 * Quiet variant - no border, transparent background
 */
export const Quiet: StoryFn<SearchFieldProps> = (args) => (
  <div style={{ background: "var(--ac-global-color-grey-200)", padding: 16 }}>
    <SearchField {...args} variant="quiet">
      <Label>Quiet Search</Label>
      <Input placeholder="Search..." />
    </SearchField>
  </div>
);

/**
 * Gallery showcasing different states and configurations
 */
export const Gallery = () => (
  <Flex direction="column" gap="size-200" width="400px">
    {/* Basic with icon (default) */}
    <SearchField>
      <Label>Default Search</Label>
      <Input placeholder="Search..." />
    </SearchField>

    {/* Without Icon */}
    <SearchField showIcon={false}>
      <Label>Without Icon</Label>
      <Input placeholder="No icon..." />
    </SearchField>

    {/* With Description */}
    <SearchField>
      <Label>Search Products</Label>
      <Input placeholder="Enter product name..." />
      <Text slot="description">Search across all product categories</Text>
    </SearchField>

    {/* Small Size */}
    <SearchField size="S">
      <Label>Small Search</Label>
      <Input placeholder="Small size..." />
    </SearchField>

    {/* Disabled */}
    <SearchField isDisabled>
      <Label>Disabled Search</Label>
      <Input placeholder="Disabled..." />
    </SearchField>

    {/* Read Only */}
    <SearchField isReadOnly defaultValue="Cannot be edited">
      <Label>Read Only Search</Label>
      <Input placeholder="Read only..." />
      <Text slot="description">
        This search field is read-only (no clear button)
      </Text>
    </SearchField>

    {/* Invalid State */}
    <SearchField isInvalid>
      <Label>Search with Error</Label>
      <Input placeholder="Invalid input..." />
      <FieldError>Please enter a valid search term</FieldError>
    </SearchField>

    {/* Required */}
    <SearchField isRequired>
      <Label>Required Search</Label>
      <Input placeholder="This field is required..." />
    </SearchField>

    {/* Quiet variant */}
    <div style={{ background: "var(--ac-global-color-grey-200)", padding: 16 }}>
      <SearchField variant="quiet">
        <Label>Quiet Variant</Label>
        <Input placeholder="Blends with background..." />
      </SearchField>
    </div>
  </Flex>
);
