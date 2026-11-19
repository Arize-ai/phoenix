import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { SearchButtonProps } from "@phoenix/components";
import { Button, Flex, SearchButton } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A search field that rests as an icon button, for toolbars too tight to give
 * an idle search field its full width. Press it and it expands leftward into
 * an S-size search field; blur it while empty and it collapses back. While it
 * holds a query it stays open showing it. Tab rests on the collapsed button
 * without opening anything, and Escape from the empty field hands focus back.
 */
const meta: Meta = {
  title: "Design System/Forms/Search Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: SearchButton,
  parameters: {
    controls: { disable: true },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <SearchButton
    aria-label="Search JSON keys and values"
    placeholder="Search keys and values"
    onChange={() => {}}
  />
);
Default.tags = ["!dev"];

const STATES: {
  label: string;
  props: Partial<SearchButtonProps>;
}[] = [
  { label: "collapsed", props: {} },
  { label: "holding a query", props: { defaultValue: "temperature" } },
  {
    label: "required",
    props: { isRequired: true, defaultValue: "temperature" },
  },
  {
    label: "read only",
    props: { isReadOnly: true, defaultValue: "temperature" },
  },
  { label: "error", props: { isInvalid: true, defaultValue: "temperature" } },
  { label: "disabled", props: { isDisabled: true } },
  {
    label: "disabled, holding a query",
    props: { isDisabled: true, defaultValue: "temperature" },
  },
];

const VARIANTS = (["default", "quiet"] as const).map((variant) => ({
  label: variant,
  code: true,
  variant,
}));

export const StatesAndVariants: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={VARIANTS}
    cellWidth="260px"
    renderCell={(state, variant) => (
      <Flex direction="row" justifyContent="end" width="100%">
        <SearchButton
          aria-label="Search JSON keys and values"
          placeholder="Search keys and values"
          variant={variant?.variant}
          onChange={() => {}}
          {...state.props}
        />
      </Flex>
    )}
  />
);
StatesAndVariants.parameters = { themeLayout: "column" };
StatesAndVariants.tags = ["!dev"];

const Toolbar = () => (
  <Flex direction="row" justifyContent="end" alignItems="center" gap="size-100">
    <SearchButton
      aria-label="Search JSON keys and values"
      placeholder="Search keys and values"
      onChange={() => {}}
    />
    <Button size="S">Expand all</Button>
    <Button size="S">Copy</Button>
  </Flex>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => <Toolbar />,
};
