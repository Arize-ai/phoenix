import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Header, ListBoxSection } from "react-aria-components";
import { useArgs } from "storybook/preview-api";

import {
  Button,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import {
  EmptyState,
  EmptyStateGraphic,
  EMPTY_STATE_GRAPHIC_SIZES,
  EMPTY_STATE_GRAPHIC_VARIANTS,
} from "@phoenix/components/empty-state";
import type { EmptyStateGraphicVariant } from "@phoenix/components/empty-state";

/** Variants grouped by render size, each group sorted alphabetically. */
const SIZE_SECTIONS = (
  [
    { size: "small", label: "Small" },
    { size: "large", label: "Large" },
  ] as const
).map(({ size, label }) => ({
  size,
  label,
  variants: EMPTY_STATE_GRAPHIC_VARIANTS.filter(
    (variant) => EMPTY_STATE_GRAPHIC_SIZES[variant] === size
  ).sort(),
}));

const sectionedListBoxCSS = css`
  .react-aria-Header {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150)
      var(--global-dimension-size-50);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xs);
    font-weight: var(--global-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
`;

const meta: Meta<typeof EmptyStateGraphic> = {
  title: "Core/Feedback/EmptyStateGraphic",
  component: EmptyStateGraphic,
  parameters: {
    layout: "padded",
    // Lay the light/dark panes out side by side in "Both" mode — the graphic is
    // small, so horizontal makes the two themes easy to compare at a glance.
    themeLayout: "row",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: EMPTY_STATE_GRAPHIC_VARIANTS,
    },
  },
  args: {
    variant: "genericAdd",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyStateGraphic>;

/**
 * The graphic is not free-form: it renders one of a fixed set of named
 * variants, each pinning a specific icon and size. Use the `variant` control to
 * switch between them. Colors flip automatically between light and dark themes.
 */
export const Default: Story = {};

/**
 * Step through every variant from a single dropdown. The selection is backed by
 * the `variant` arg, so in "Both" theme mode it stays in sync across the light
 * and dark panes — change it on either side and both update together (Storybook
 * args live above both theme panes; component-local state would not sync).
 */
export const AllVariants: Story = {
  render: function VariantPicker(args) {
    const [, updateArgs] = useArgs();
    return (
      <Flex direction="column" gap="size-200" alignItems="center">
        <Select
          size="M"
          aria-label="Empty state graphic variant"
          value={args.variant}
          onChange={(key) =>
            key && updateArgs({ variant: key as EmptyStateGraphicVariant })
          }
        >
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox css={sectionedListBoxCSS}>
              {SIZE_SECTIONS.map(({ size, label, variants }) => (
                <ListBoxSection key={size} id={size}>
                  <Header>{label}</Header>
                  {variants.map((variant) => (
                    <SelectItem key={variant} id={variant}>
                      {variant}
                    </SelectItem>
                  ))}
                </ListBoxSection>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <EmptyStateGraphic variant={args.variant} />
      </Flex>
    );
  },
};

/**
 * Every named variant at once. Each region/topic in the app maps to exactly one
 * of these, so the same empty state always looks identical wherever it appears.
 * Stacked vertically in "Both" mode since the grid itself is already wide.
 */
export const Gallery: Story = {
  parameters: { themeLayout: "column" },
  render: () => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 32,
        alignItems: "flex-start",
      }}
    >
      {EMPTY_STATE_GRAPHIC_VARIANTS.map((variant) => (
        <figure key={variant} style={{ margin: 0 }}>
          <EmptyStateGraphic variant={variant} />
          <figcaption
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--global-text-color-700)",
            }}
          >
            {variant}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * The graphic in context, used as the `graphic` slot of an {@link EmptyState}.
 */
export const InEmptyState: Story = {
  render: () => (
    <EmptyState
      graphic={<EmptyStateGraphic variant="genericAdd" />}
      title="Nothing here yet"
      description="When data is recorded it will show up in this space."
      action={{
        type: "buttons",
        buttons: [
          {
            variant: "primary",
            children: "View documentation",
            onPress: () => {},
          },
        ],
      }}
    />
  ),
};
