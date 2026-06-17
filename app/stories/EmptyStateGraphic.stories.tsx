import type { Meta, StoryObj } from "@storybook/react";

import {
  EmptyState,
  EmptyStateGraphic,
  EMPTY_STATE_GRAPHIC_VARIANTS,
} from "@phoenix/components/empty-state";

const meta: Meta<typeof EmptyStateGraphic> = {
  title: "Core/Feedback/EmptyStateGraphic",
  component: EmptyStateGraphic,
  parameters: {
    layout: "padded",
    themeLayout: "column",
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
 * Every named variant. Each region/topic in the app maps to exactly one of
 * these, so the same empty state always looks identical wherever it appears.
 */
export const AllVariants: Story = {
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
