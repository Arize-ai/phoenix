import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import type { SearchButtonProps } from "@phoenix/components";
import {
  Flex,
  Icon,
  IconButton,
  Icons,
  SearchButton,
} from "@phoenix/components";

/**
 * A search field at rest as an icon button. Press it and it expands into an
 * S-size search field; blur it while empty and it collapses back. While it
 * holds a query it stays open showing it. Tab rests on the collapsed button
 * without opening anything, and Escape from the empty field hands focus back.
 */
const meta: Meta<typeof SearchButton> = {
  title: "Core/Forms/Search Button",
  component: SearchButton,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["default", "quiet"],
    },
  },
  args: {
    "aria-label": "Search",
    placeholder: "Search...",
    onChange: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof SearchButton>;

export const Default: Story = {};

/** Holding a query, it mounts already expanded rather than hiding the filter. */
export const WithDefaultValue: Story = {
  args: {
    defaultValue: "temperature",
  },
};

/** Borderless, for toolbars made of quiet `IconButton`s. */
export const Quiet: Story = {
  args: {
    variant: "quiet",
  },
};

/**
 * The compact toolbar it exists for: at rest it takes an icon button's
 * footprint beside the other controls, and expands leftward when pressed. The
 * variant follows the neighbors — quiet beside `IconButton`s, default
 * beside bordered `Button`s.
 */
export const InToolbar: StoryObj<SearchButtonProps> = {
  args: {
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
