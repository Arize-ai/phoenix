import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Flex, Icon, Icons, Token, type TokenProps } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A short piece of text in a rounded pill. A token can be static, pressable
 * (`onPress`), removable (`onRemove`), or both, in which case the text and
 * the remove button are separate buttons.
 */
const meta: Meta = {
  title: "Design System/Badges/Token",
  component: Token,
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const noop = () => {};

const SIZES: { label: NonNullable<TokenProps["size"]>; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
  { label: "L", code: true },
];

const FORMS: { label: string; props: Partial<TokenProps> }[] = [
  { label: "Static", props: {} },
  { label: "Pressable", props: { onPress: noop } },
  { label: "Removable", props: { onRemove: noop } },
  {
    label: "Pressable and removable",
    props: { onPress: noop, onRemove: noop },
  },
];

const CONTENT: { label: string; props: Partial<TokenProps> }[] = [
  { label: "Text", props: {} },
  {
    label: "Leading visual",
    props: { leadingVisual: <Icon svg={<Icons.InfoFilled />} /> },
  },
];

const STATES: { label: string; props: Partial<TokenProps> }[] = [
  { label: "Enabled", props: {} },
  { label: "Disabled", props: { isDisabled: true } },
];

const COLORS: { label: string; code: true; color?: string }[] = [
  { label: "default", code: true },
  { label: "info", code: true, color: "var(--global-color-info)" },
  { label: "success", code: true, color: "var(--global-color-success)" },
  { label: "warning", code: true, color: "var(--global-color-warning)" },
  { label: "danger", code: true, color: "var(--global-color-danger)" },
];

const MAX_WIDTHS: { label: string; code: true; maxWidth?: string }[] = [
  { label: "160px (default)", code: true },
  { label: "100px", code: true, maxWidth: "100px" },
  { label: "300px", code: true, maxWidth: "300px" },
];

const LENGTHS: { label: string; text: string }[] = [
  { label: "1 character", text: "A" },
  { label: "Regular", text: "Production" },
  {
    label: "Long",
    text: "Retrieval-augmented generation evaluation run from the nightly regression suite",
  },
];

export const Default: StoryFn = () => <Token>Production</Token>;
Default.tags = ["!dev"];

export const FormsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={FORMS}
    columns={SIZES}
    renderCell={(form, size) => (
      <Token {...form.props} size={size?.label}>
        Production
      </Token>
    )}
  />
);
FormsAndSizes.tags = ["!dev"];
FormsAndSizes.parameters = { themeLayout: "column" };

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={SIZES}
    renderCell={(content, size) => (
      <Token {...content.props} size={size?.label} onRemove={noop}>
        Production
      </Token>
    )}
  />
);
ContentAndSizes.tags = ["!dev"];
ContentAndSizes.parameters = { themeLayout: "column" };

export const FormsAndStates: StoryFn = () => (
  <OptionGrid
    rows={FORMS}
    columns={STATES}
    renderCell={(form, state) => (
      <Token {...form.props} {...state?.props}>
        Production
      </Token>
    )}
  />
);
FormsAndStates.tags = ["!dev"];
FormsAndStates.parameters = { themeLayout: "column" };

export const Colors: StoryFn = () => (
  <OptionGrid
    rows={COLORS}
    renderCell={(color) => (
      <Token color={color.color} onRemove={noop}>
        Production
      </Token>
    )}
  />
);
Colors.tags = ["!dev"];
Colors.parameters = { themeLayout: "row" };

/**
 * Text longer than `maxWidth` truncates with an ellipsis. The default is
 * `var(--global-dimension-size-2000)`; pass `maxWidth` with any CSS length
 * to change it.
 */
export const ContentLengthAndMaxWidth: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={MAX_WIDTHS}
    renderCell={(length, maxWidth) => (
      <Token maxWidth={maxWidth?.maxWidth}>{length.text}</Token>
    )}
  />
);
ContentLengthAndMaxWidth.tags = ["!dev"];
ContentLengthAndMaxWidth.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex gap="size-100" wrap justifyContent="center">
      <Token>Default</Token>
      <Token color="var(--global-color-info)">Info</Token>
      <Token color="var(--global-color-success)">Success</Token>
      <Token color="var(--global-color-warning)">Warning</Token>
      <Token color="var(--global-color-danger)">Danger</Token>
      <Token onRemove={() => {}}>Removable</Token>
    </Flex>
  ),
};
