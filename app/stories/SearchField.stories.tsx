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
import { SearchIcon } from "@phoenix/components/field/SearchIcon";

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
  },
  args: {
    onSubmit: fn(),
    onChange: fn(),
    onClear: fn(),
  },
};

export default meta;

/**
 * Basic SearchField with label and input
 */
const Template: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args}>
    <Label>Search</Label>
    <Input placeholder="Type to search..." />
  </SearchField>
);

export const Default = Template.bind({});

/**
 * SearchField with search icon positioned at the start of the input
 */
export const WithIcon: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args}>
    <Label>Search with Icon</Label>

    <SearchIcon />
    <Input placeholder="Search..." style={{ paddingLeft: "2rem" }} />
  </SearchField>
);

/**
 * SearchField with both search icon and clear button
 */
export const WithIconAndClearButton: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args}>
    <Label>Full Featured Search</Label>
    <SearchIcon />
    <Input
      placeholder="Search with clear button..."
      style={{ paddingLeft: "2rem", paddingRight: "2rem" }}
    />
  </SearchField>
);

/**
 * Gallery showcasing different states and configurations
 */
export const Gallery = () => (
  <Flex direction="column" gap="size-200" width="400px">
    {/* Basic */}
    <SearchField>
      <Label>Basic Search</Label>
      <Input placeholder="Basic search field" />
    </SearchField>

    {/* With Icon */}
    <SearchField>
      <Label>With Search Icon</Label>
      <SearchIcon />
      <Input placeholder="Search..." style={{ paddingLeft: "2rem" }} />
    </SearchField>

    {/* With Description */}
    <SearchField>
      <Label>Search Products</Label>
      <SearchIcon />
      <Input
        placeholder="Enter product name..."
        style={{ paddingLeft: "2rem" }}
      />
      <Text slot="description">Search across all product categories</Text>
    </SearchField>

    {/* Small Size */}
    <SearchField size="S">
      <Label>Small Search</Label>
      <SearchIcon />
      <Input placeholder="Small size..." style={{ paddingLeft: "2rem" }} />
    </SearchField>

    {/* Disabled */}
    <SearchField isDisabled>
      <Label>Disabled Search</Label>
      <SearchIcon />
      <Input placeholder="Disabled..." style={{ paddingLeft: "2rem" }} />
    </SearchField>

    {/* Read Only */}
    <SearchField isReadOnly>
      <Label>Read Only Search</Label>
      <SearchIcon />
      <Input
        placeholder="Read only..."
        style={{ paddingLeft: "2rem" }}
        value="Cannot be edited"
      />
      <Text slot="description">This search field is read-only</Text>
    </SearchField>

    {/* Invalid State */}
    <SearchField isInvalid>
      <Label>Search with Error</Label>
      <SearchIcon />
      <Input placeholder="Invalid input..." style={{ paddingLeft: "2rem" }} />
      <FieldError>Please enter a valid search term</FieldError>
    </SearchField>

    {/* Required */}
    <SearchField isRequired>
      <Label>Required Search</Label>
      <SearchIcon />
      <Input
        placeholder="This field is required..."
        style={{ paddingLeft: "2rem" }}
      />
    </SearchField>
  </Flex>
);

WithIcon.args = {
  size: "M",
};

WithIconAndClearButton.args = {
  size: "M",
};
