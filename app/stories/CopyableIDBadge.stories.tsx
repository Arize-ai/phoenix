import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { CopyableIDBadge } from "@phoenix/components";

/**
 * A ghost-style ID element that copies its value when pressed. The leading ID
 * icon becomes a copy icon on hover and a checkmark after copying, while the
 * visible value changes without shifting the component's width.
 */
const meta = {
  title: "Core/ID/Copyable ID Badge",
  component: CopyableIDBadge,
  parameters: {
    layout: "centered",
    themeLayout: "row",
  },
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["S", "M", "L"] },
    showValue: { control: "boolean" },
    overflowMode: {
      control: "select",
      options: ["visible", "truncate"],
    },
  },
} satisfies Meta<typeof CopyableIDBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const LONG_ID = `span_${"0123456789abcdef".repeat(32)}`;

export const Default: Story = {
  args: {
    id: "c5b943dba87507a2",
  },
};

/** The tooltip can name the entity being copied. */
export const CustomTooltip: Story = {
  args: {
    id: "c5b943dba87507a2",
    tooltipText: "Copy Span ID",
  },
};

const columnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  align-items: flex-start;
`;

const exampleCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const labelCSS = css`
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

const truncationFrameCSS = css`
  min-width: 0;

  .copyable-id-badge {
    width: 100%;
    max-width: 100%;
  }
`;

/** Hover and press each example to compare the adaptive affordance. */
export const LengthVariants: Story = {
  render: () => (
    <div css={columnCSS}>
      {[
        { label: "icon only (long ID tooltip)", id: LONG_ID, showValue: false },
        { label: "fewer than 4 characters", id: "abc" },
        { label: "4 characters", id: "ab12" },
        { label: "5 characters", id: "ab123" },
        { label: "6 characters", id: "abc123" },
        { label: "7 characters", id: "abc1234" },
        { label: "12 characters", id: "a1b2c3d4e5f6" },
        { label: "UUID", id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
      ].map(({ label, id, showValue }) => (
        <div key={label} css={exampleCSS}>
          <span css={labelCSS}>{label}</span>
          <CopyableIDBadge id={id} showValue={showValue} />
        </div>
      ))}
    </div>
  ),
};

/**
 * The full value remains visible by default. At constrained widths, middle
 * truncation favors the first four characters, then the last four. Narrower
 * widths fall back toward the first three and last two before consuming more
 * of the suffix.
 */
export const OverflowModes: Story = {
  parameters: {
    themeLayout: "column",
  },
  render: () => (
    <div css={columnCSS}>
      <div css={exampleCSS}>
        <span css={labelCSS}>full value</span>
        <CopyableIDBadge id={LONG_ID} />
      </div>
      {[
        {
          label: "middle truncation — 400px",
          width: "var(--global-dimension-size-5000)",
        },
        {
          label: "first 4 / last 4 split — 104px",
          width:
            "calc(var(--global-dimension-size-1200) + var(--global-dimension-size-100))",
        },
        {
          label: "first 3 / last 2 split — 80px",
          width: "var(--global-dimension-size-1000)",
        },
        {
          label: "suffix starts giving way — 72px",
          width: "var(--global-dimension-size-900)",
        },
        {
          label: "suffix gives way — 64px",
          width: "var(--global-dimension-size-800)",
        },
      ].map(({ label, width }) => (
        <div key={label} css={exampleCSS}>
          <span css={labelCSS}>{label}</span>
          <div css={truncationFrameCSS} style={{ width }}>
            <CopyableIDBadge id={LONG_ID} overflowMode="truncate" />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** The leading icon follows the standard component size scale. */
export const Sizes: Story = {
  render: () => (
    <div css={columnCSS}>
      <CopyableIDBadge id="a1b2c3d4e5f6" size="S" />
      <CopyableIDBadge id="a1b2c3d4e5f6" size="M" />
      <CopyableIDBadge id="a1b2c3d4e5f6" size="L" />
    </div>
  ),
};
