import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Badge, Icon, Icons } from "@phoenix/components";
import type { BadgeProps } from "@phoenix/components/core/badge";

const meta: Meta<typeof Badge> = {
  title: "Core/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "info", "success", "warning", "danger"],
    },
    size: {
      control: "select",
      options: ["S", "M", "L"],
    },
    overflowMode: {
      control: "select",
      options: ["wrap", "truncate"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

/**
 * The default badge with neutral styling. Use for general-purpose metadata
 * like archived, deleted, paused, draft, not started, or ended statuses.
 */
export const Default: Story = {
  args: {
    children: "Archived",
  },
};

/**
 * Informative badges use blue to convey active or in-progress states.
 * Use for: active, in use, live, published.
 */
export const Info: Story = {
  args: {
    variant: "info",
    children: "Active",
  },
};

/**
 * Success badges use green to convey positive outcomes.
 * Use for: approved, complete, success, new, purchased, licensed.
 */
export const Success: Story = {
  args: {
    variant: "success",
    children: "Approved",
  },
};

/**
 * Warning badges use orange to convey caution or pending action.
 * Use for: pending, request, needs review, expiring.
 */
export const Warning: Story = {
  args: {
    variant: "warning",
    children: "Pending",
  },
};

/**
 * Danger badges use red to convey errors or critical states.
 * Use for: error, alert, rejected, failed.
 */
export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Failed",
  },
};

const rowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const columnCSS = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/**
 * All semantic variants displayed together. When badges have a semantic meaning,
 * they should use the appropriate variant color to help convey that meaning at a glance.
 *
 * - **default** (neutral) — archived, deleted, paused, draft, not started, ended
 * - **info** (informative) — active, in use, live, published
 * - **success** (positive) — approved, complete, success, new, purchased, licensed
 * - **warning** (notice) — pending, request, needs review, expiring
 * - **danger** (negative) — error, alert, rejected, failed
 */
export const AllVariants: Story = {
  render: () => (
    <div css={rowCSS}>
      <Badge variant="default">Archived</Badge>
      <Badge variant="info">Active</Badge>
      <Badge variant="success">Approved</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Failed</Badge>
    </div>
  ),
};

/**
 * Badges come in three sizes: small, medium, and large.
 * The small size is the default and most frequently used option.
 * Use the other sizes sparingly to create a hierarchy of importance on a page.
 */
export const Sizes: Story = {
  render: () => (
    <div css={rowCSS}>
      <Badge variant="success" size="S">
        Small
      </Badge>
      <Badge variant="success" size="M">
        Medium
      </Badge>
      <Badge variant="success" size="L">
        Large
      </Badge>
    </div>
  ),
};

/**
 * Badges can include an icon alongside text for added visual context.
 * Always prefer text labels over icon-only badges for clarity.
 */
export const WithIcon: Story = {
  render: () => (
    <div css={rowCSS}>
      <Badge variant="success">
        <Icon svg={<Icons.CheckmarkOutline />} />
        Licensed
      </Badge>
      <Badge variant="danger">
        <Icon svg={<Icons.CloseOutline />} />
        Rejected
      </Badge>
      <Badge variant="info">
        <Icon svg={<Icons.InfoOutline />} />
        Published
      </Badge>
    </div>
  ),
};

/**
 * When a badge's label is too long for the available horizontal space,
 * it wraps to form another line by default (`overflowMode="wrap"`).
 *
 * Set `overflowMode="truncate"` to truncate with an ellipsis instead.
 */
export const OverflowModes: Story = {
  render: () => (
    <div css={columnCSS}>
      <div>
        <p
          css={css(
            `margin-bottom: 8px; color: var(--global-text-color-700); font-size: 12px;`
          )}
        >
          overflowMode=&quot;wrap&quot; (default)
        </p>
        <div css={css(`width: 120px;`)}>
          <Badge variant="info">24 days left in trial</Badge>
        </div>
      </div>
      <div>
        <p
          css={css(
            `margin-bottom: 8px; color: var(--global-text-color-700); font-size: 12px;`
          )}
        >
          overflowMode=&quot;truncate&quot;
        </p>
        <div css={css(`width: 120px;`)}>
          <Badge variant="info" overflowMode="truncate">
            24 days left in trial
          </Badge>
        </div>
      </div>
    </div>
  ),
};

/**
 * All sizes across all variants for a complete visual reference.
 */
export const SizesByVariant: Story = {
  render: () => {
    const variants: BadgeProps["variant"][] = [
      "default",
      "info",
      "success",
      "warning",
      "danger",
    ];
    const sizes: BadgeProps["size"][] = ["S", "M", "L"];
    return (
      <div css={columnCSS}>
        {variants.map((variant) => (
          <div key={variant} css={rowCSS}>
            {sizes.map((size) => (
              <Badge key={`${variant}-${size}`} variant={variant} size={size}>
                {variant} {size}
              </Badge>
            ))}
          </div>
        ))}
      </div>
    );
  },
};
