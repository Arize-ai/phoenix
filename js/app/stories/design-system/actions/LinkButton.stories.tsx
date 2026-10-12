import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import { Icon, Icons, LinkButton } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

type LinkButtonProps = ComponentProps<typeof LinkButton>;

/**
 * A router link styled as a button: use it when an action navigates, so the
 * element keeps a link's semantics (open in a new tab, copy the address)
 * while matching the buttons beside it. It shares `Button`'s variants and
 * sizes.
 *
 * With only a `leadingVisual` and an `aria-label` it renders icon-only, as
 * the Assistant settings and View trace links do. There is no separate icon
 * link component.
 */
const meta: Meta = {
  title: "Design System/Actions/Link Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: LinkButton,
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <LinkButton to="/traces">View details</LinkButton>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "row" };

const VARIANTS: NonNullable<LinkButtonProps["variant"]>[] = [
  "default",
  "primary",
  "success",
  "danger",
  "severe",
  "quiet",
];

const SIZES: NonNullable<LinkButtonProps["size"]>[] = ["S", "M", "L"];

const STATES: {
  label: string;
  code?: boolean;
  props: Partial<LinkButtonProps>;
}[] = [
  { label: "enabled", props: {} },
  { label: "isDisabled", code: true, props: { isDisabled: true } },
];

const CONTENT: { label: string; props: Partial<LinkButtonProps> }[] = [
  { label: "Text", props: { children: "View details" } },
  {
    label: "Leading visual",
    props: {
      children: "View trace",
      leadingVisual: <Icon svg={<Icons.Trace />} />,
    },
  },
  {
    label: "Trailing visual",
    props: {
      children: "Open in playground",
      trailingVisual: <Icon svg={<Icons.ArrowUpRightCorner />} />,
    },
  },
  {
    label: "Icon only",
    props: {
      "aria-label": "View trace",
      leadingVisual: <Icon svg={<Icons.Trace />} />,
    },
  },
];

const SIZE_COLUMNS = SIZES.map((size) => ({ label: size, code: true, size }));

/**
 * The `severe` variant and size `L` are accepted but not styled yet, so they
 * render like `default` and a button with no height or padding (smaller
 * than `S`).
 */
export const VariantsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS.map((variant) => ({ label: variant, code: true, variant }))}
    columns={SIZE_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <LinkButton to="/traces" variant={row.variant} size={column.size}>
          View details
        </LinkButton>
      ) : null
    }
  />
);
VariantsAndSizes.storyName = "Variants and Sizes";
VariantsAndSizes.tags = ["!dev"];

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={SIZE_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <LinkButton to="/traces" size={column.size} {...row.props} />
      ) : null
    }
  />
);
ContentAndSizes.storyName = "Content and Sizes";
ContentAndSizes.tags = ["!dev"];

export const VariantsAndStates: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS.map((variant) => ({ label: variant, code: true, variant }))}
    columns={STATES}
    renderCell={(row, column) =>
      column ? (
        <LinkButton to="/traces" variant={row.variant} {...column.props}>
          View details
        </LinkButton>
      ) : null
    }
  />
);
VariantsAndStates.storyName = "Variants and States";
VariantsAndStates.tags = ["!dev"];

export const ContentAndStates: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={STATES}
    renderCell={(row, column) =>
      column ? (
        <LinkButton to="/traces" {...row.props} {...column.props} />
      ) : null
    }
  />
);
ContentAndStates.storyName = "Content and States";
ContentAndStates.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  args: {
    children: "View details",
  },
};
