import type { StoryObj, Meta, StoryFn } from "@storybook/react";
import { fn } from "storybook/test";

import type { SearchButtonProps, SearchFieldProps } from "@phoenix/components";
import {
  FieldError,
  Flex,
  Icon,
  IconButton,
  Icons,
  Input,
  Label,
  SearchButton,
  SearchField,
  Text,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";

/**
 * Search input. `SearchField` is the labeled field: search icon, input, and
 * clear button. `SearchButton`, shown in the `Search Button…` stories, is the
 * compact form for toolbars: a search field at rest as an icon button. Press
 * it and it expands into an S-size search field; blur it while empty and it
 * collapses back. While it holds a query it stays open showing it. Tab rests
 * on the collapsed button without opening anything, and Escape from the empty
 * field hands focus back.
 */
const meta: Meta = {
  title: "Design System/Forms/Search",
  tags: ["legacy", "unreviewed"],
  component: SearchField,
  parameters: {
    controls: { expanded: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=152-486",
    },
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
    variant: {
      control: { type: "radio" },
      options: ["default", "quiet"],
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
 * Basic SearchField with label, search icon, and input.
 */
const Template: StoryFn<SearchFieldProps> = (args) => (
  <SearchField {...args}>
    <Label>Search</Label>
    <SearchIcon />
    <Input placeholder="Type to search..." />
  </SearchField>
);

export const Default = {
  render: Template,
};

export const WithoutIcon: StoryObj<SearchFieldProps> = {
  render: (args) => (
    <SearchField {...args}>
      <Label>Search without Icon</Label>
      <Input placeholder="Search..." />
    </SearchField>
  ),
};

export const Quiet: StoryObj<SearchFieldProps> = {
  render: (args) => (
    <div style={{ background: "var(--global-color-gray-200)", padding: 16 }}>
      <SearchField {...args} variant="quiet">
        <Label>Quiet Search</Label>
        <SearchIcon />
        <Input placeholder="Search..." />
      </SearchField>
    </div>
  ),
};

export const Gallery = () => (
  <Flex direction="column" gap="size-200" width="400px">
    {/* Basic with icon */}
    <SearchField>
      <Label>With Search Icon</Label>
      <SearchIcon />
      <Input placeholder="Search..." />
    </SearchField>

    {/* Without Icon */}
    <SearchField>
      <Label>Without Icon</Label>
      <Input placeholder="No icon..." />
    </SearchField>

    {/* With Description */}
    <SearchField>
      <Label>Search Products</Label>
      <SearchIcon />
      <Input placeholder="Enter product name..." />
      <Text slot="description">Search across all product categories</Text>
    </SearchField>

    {/* Small Size */}
    <SearchField size="S">
      <Label>Small Search</Label>
      <SearchIcon />
      <Input placeholder="Small size..." />
    </SearchField>

    {/* Disabled */}
    <SearchField isDisabled>
      <Label>Disabled Search</Label>
      <SearchIcon />
      <Input placeholder="Disabled..." />
    </SearchField>

    {/* Read Only */}
    <SearchField isReadOnly defaultValue="Cannot be edited">
      <Label>Read Only Search</Label>
      <SearchIcon />
      <Input placeholder="Read only..." />
      <Text slot="description">
        This search field is read-only (no clear button)
      </Text>
    </SearchField>

    {/* Invalid State */}
    <SearchField isInvalid>
      <Label>Search with Error</Label>
      <SearchIcon />
      <Input placeholder="Invalid input..." />
      <FieldError>Please enter a valid search term</FieldError>
    </SearchField>

    {/* Required */}
    <SearchField isRequired>
      <Label>Required Search</Label>
      <SearchIcon />
      <Input placeholder="This field is required..." />
    </SearchField>

    {/* Quiet variant */}
    <div style={{ background: "var(--global-color-gray-200)", padding: 16 }}>
      <SearchField variant="quiet">
        <Label>Quiet Variant</Label>
        <SearchIcon />
        <Input placeholder="Blends with background..." />
      </SearchField>
    </div>
  </Flex>
);

type SearchButtonStory = StoryObj<SearchButtonProps>;

/**
 * Shared by every `SearchButton` story: renders the button rather than the
 * meta's `SearchField`, and supplies its label and placeholder.
 */
const searchButtonStory: SearchButtonStory = {
  render: (args) => <SearchButton {...args} />,
  args: {
    "aria-label": "Search",
    placeholder: "Search...",
  },
};

export const SearchButtonDefault: SearchButtonStory = {
  ...searchButtonStory,
};

/** Holding a query, it mounts already expanded rather than hiding the filter. */
export const SearchButtonWithDefaultValue: SearchButtonStory = {
  ...searchButtonStory,
  args: {
    ...searchButtonStory.args,
    defaultValue: "temperature",
  },
};

/** Borderless, for toolbars made of quiet `IconButton`s. */
export const SearchButtonQuiet: SearchButtonStory = {
  ...searchButtonStory,
  args: {
    ...searchButtonStory.args,
    variant: "quiet",
  },
};

/**
 * The compact toolbar it exists for: at rest it takes an icon button's
 * footprint beside the other controls, and expands leftward when pressed. The
 * variant follows the neighbors — quiet beside `IconButton`s, default
 * beside bordered `Button`s.
 */
export const SearchButtonInToolbar: SearchButtonStory = {
  ...searchButtonStory,
  args: {
    ...searchButtonStory.args,
    variant: "quiet",
  },
  render: (args) => (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      justifyContent="end"
    >
      <SearchButton {...args} />
      <IconButton size="S" aria-label="Copy">
        <Icon svg={<Icons.Duplicate />} />
      </IconButton>
      <IconButton size="S" aria-label="Settings">
        <Icon svg={<Icons.Settings />} />
      </IconButton>
    </Flex>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<SearchFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: Template,
};
