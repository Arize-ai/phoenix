import type { Meta, StoryObj } from "@storybook/react";

import {
  EmptyState,
  EmptyStateGraphic,
  EMPTY_STATE_GRAPHIC_SIZES,
  EMPTY_STATE_GRAPHIC_VARIANTS,
} from "@phoenix/components/core/empty";
import type { EmptyStateGraphicVariant } from "@phoenix/components/core/empty";

const meta: Meta<typeof EmptyStateGraphic> = {
  title: "Core/Feedback/EmptyStateGraphic",
  component: EmptyStateGraphic,
  parameters: {
    layout: "padded",
    // The galleries are wide, so stack the light/dark panes vertically in
    // "Both" mode rather than squeezing two grids side by side.
    themeLayout: "column",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyStateGraphic>;

/** `genericAdd`/`genericEdit` — the fallbacks for surfaces without their own entry. */
const GENERIC_VARIANTS = EMPTY_STATE_GRAPHIC_VARIANTS.filter((variant) =>
  variant.startsWith("generic")
).sort();

/** Domain surfaces that render at the small size (excludes the generic ones). */
const SMALL_VARIANTS = EMPTY_STATE_GRAPHIC_VARIANTS.filter(
  (variant) =>
    EMPTY_STATE_GRAPHIC_SIZES[variant] === "small" &&
    !variant.startsWith("generic")
).sort();

/** Domain surfaces that render at the large size. */
const LARGE_VARIANTS = EMPTY_STATE_GRAPHIC_VARIANTS.filter(
  (variant) => EMPTY_STATE_GRAPHIC_SIZES[variant] === "large"
).sort();

/**
 * Renders each variant in a real {@link EmptyState} — graphic above the variant
 * name (shown as the description, with no title) — so it appears with the same
 * layout and typography it gets in the app.
 */
function renderGallery(variants: EmptyStateGraphicVariant[]) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 48,
        alignItems: "flex-start",
      }}
    >
      {variants.map((variant) => (
        <div key={variant} style={{ width: 320 }}>
          <EmptyState
            graphic={<EmptyStateGraphic variant={variant} />}
            description={variant}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The generic action prompts. `genericAdd` is the default empty state for any
 * surface that does not (yet) warrant its own entry.
 */
export const Generic: Story = {
  render: () => renderGallery(GENERIC_VARIANTS),
};

/**
 * Every domain surface that renders at the large size, sorted alphabetically.
 */
export const Large: Story = {
  render: () => renderGallery(LARGE_VARIANTS),
};

/**
 * Every domain surface that renders at the small size, sorted alphabetically.
 */
export const Small: Story = {
  render: () => renderGallery(SMALL_VARIANTS),
};
