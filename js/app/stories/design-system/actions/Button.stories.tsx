import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { ButtonProps } from "@phoenix/components";
import {
  Button,
  Flex,
  Icon,
  Icons,
  SelectChevronUpDownIcon,
} from "@phoenix/components";
import { Keyboard, VisuallyHidden } from "@phoenix/components/core/content";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A text button for an action. Choose the variant by the action's weight:
 * `default` for most actions, `primary` for the one action a view leads to,
 * `danger` for a destructive one, `success` to confirm one that just
 * succeeded (a copied value), and `quiet` for a low-emphasis action inside
 * dense UI. `S` is the size used in toolbars, tables and dense panels; `M`
 * is the default for forms and dialogs.
 *
 * With only a `leadingVisual` and an `aria-label` it renders icon-only: a
 * square at the button height that keeps the variant's border and fill, as
 * the row action menus and paginators use it. `IconButton` is the borderless
 * alternative with a larger glyph; whether both should exist is tracked
 * separately.
 */
const meta: Meta = {
  title: "Design System/Actions/Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Button,
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2047",
    },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <Flex direction="row" gap="size-100">
    <Button>Cancel</Button>
    <Button variant="primary">Save</Button>
  </Flex>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "row" };

const VARIANTS: NonNullable<ButtonProps["variant"]>[] = [
  "default",
  "primary",
  "success",
  "danger",
  "severe",
  "quiet",
];

const SIZES: NonNullable<ButtonProps["size"]>[] = ["S", "M", "L"];

const shortcut = (
  <Keyboard>
    <VisuallyHidden>modifier</VisuallyHidden>
    <span aria-hidden="true">⌘</span>
    <VisuallyHidden>enter</VisuallyHidden>
    <span aria-hidden="true">⏎</span>
  </Keyboard>
);

const STATES: {
  label: string;
  code?: boolean;
  props: Partial<ButtonProps>;
}[] = [
  { label: "enabled", props: {} },
  { label: "isDisabled", code: true, props: { isDisabled: true } },
  { label: "isPending", code: true, props: { isPending: true } },
];

const VARIANT_ROWS = VARIANTS.map((variant) => ({
  label: variant,
  code: true,
  variant,
}));

const SIZE_COLUMNS = SIZES.map((size) => ({ label: size, code: true, size }));

const CONTENT: {
  label: string;
  props: Partial<ButtonProps>;
  children?: string;
}[] = [
  { label: "Plain", props: {}, children: "Save" },
  {
    label: "Leading visual",
    props: { leadingVisual: <Icon svg={<Icons.Share />} /> },
    children: "Share",
  },
  {
    label: "Trailing chevron",
    props: { trailingVisual: <SelectChevronUpDownIcon /> },
    children: "Example 1",
  },
];

/**
 * Some options are accepted but not styled yet: the `severe` variant renders
 * like `default` and size `L` has no height or padding, so it is smaller
 * than `S`.
 */
export const VariantsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={VARIANT_ROWS}
    columns={SIZE_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <Flex direction="row" gap="size-100">
          <Button variant={row.variant} size={column.size}>
            Save
          </Button>
          <Button
            variant={row.variant}
            size={column.size}
            aria-label="More actions"
            leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
          />
        </Flex>
      ) : null
    }
  />
);
VariantsAndSizes.storyName = "Variants and Sizes";
VariantsAndSizes.tags = ["!dev"];

/** `isPending` is accepted but not styled: a pending button looks enabled. */
export const VariantsAndStates: StoryFn = () => (
  <OptionGrid
    rows={VARIANT_ROWS}
    columns={STATES}
    renderCell={(row, column) =>
      column ? (
        <Flex direction="row" gap="size-100">
          <Button variant={row.variant} {...column.props}>
            Save
          </Button>
          <Button
            variant={row.variant}
            aria-label="More actions"
            leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
            {...column.props}
          />
        </Flex>
      ) : null
    }
  />
);
VariantsAndStates.storyName = "Variants and States";
VariantsAndStates.tags = ["!dev"];

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={SIZE_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <Button size={column.size} {...row.props}>
          {row.children}
        </Button>
      ) : null
    }
  />
);
ContentAndSizes.storyName = "Content and Sizes";
ContentAndSizes.tags = ["!dev"];

export const LeadingAndTrailingVisuals: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={STATES}
    renderCell={(row, column) =>
      column ? (
        <Button {...row.props} {...column.props}>
          {row.children}
        </Button>
      ) : null
    }
  />
);
LeadingAndTrailingVisuals.storyName = "Leading and Trailing Visuals";
LeadingAndTrailingVisuals.tags = ["!dev"];

export const TrailingShortcut: StoryFn = () => (
  <OptionGrid
    rows={VARIANT_ROWS}
    columns={STATES}
    renderCell={(row, column) =>
      column ? (
        <Button
          variant={row.variant}
          trailingVisual={shortcut}
          {...column.props}
        >
          Save
        </Button>
      ) : null
    }
  />
);
TrailingShortcut.storyName = "Trailing Shortcut";
TrailingShortcut.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="row" gap="size-100">
      <Button>Cancel</Button>
      <Button variant="primary">Save</Button>
    </Flex>
  ),
};
