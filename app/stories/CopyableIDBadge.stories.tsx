import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { CopyableIDBadge } from "@phoenix/components";

const meta: Meta<typeof CopyableIDBadge> = {
  title: "Core/ID/Copyable ID Badge",
  component: CopyableIDBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
An ID badge that copies its value when pressed. It mirrors the \`IDBadge\` used in
the session panel title bar: an ID icon followed by the value in a badge.

- The leading ID icon becomes a copy icon on hover and a green checkmark once copied.
- At rest the full id is shown. While copy/copied is displaying, a left-aligned
  \`copy\` / \`copied\` label overwrites the leading characters and the trailing id
  characters fade out — nearly invisible next to the label, ramping up to the
  resting subdued opacity over a few characters — **without shifting layout**:
  - **< 4 chars** — too short to fit a label, so the icon changes and the whole id dims to the resting subdued opacity.
  - **4 / 5 chars** — the label is \`copy\` for both hover and copied (\`copied\` would not fit).
  - **6+ chars** — the label is \`copy\` on hover and \`copied\` while copied.

Pass \`showValue={false}\` for an icon-only variant: the id is hidden but still
copied on press and surfaced via the badge's \`title\`. It renders at the same
height as the labeled variant.
        `,
      },
    },
  },
  argTypes: {
    id: { control: "text" },
    size: { control: "select", options: ["S", "M", "L"] },
    showValue: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof CopyableIDBadge>;

/**
 * A typical, long ID. Hover to see a left-aligned "copy" label with the trailing
 * chars dimmed; click to copy and watch the checkmark with "copied".
 */
export const Default: Story = {
  args: {
    id: "a1b2c3d4e5f6",
  },
};

const columnCSS = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
`;

const labelCSS = css`
  color: var(--global-text-color-700);
  font-size: 12px;
`;

/**
 * The affordance adapts to the length of the id. Hover and click each one to
 * compare the hover ("copy") and copied ("copied") states.
 */
export const LengthVariants: Story = {
  render: () => (
    <div css={columnCSS}>
      {[
        {
          label: "icon only (showValue=false)",
          id: "abc123",
          showValue: false,
        },
        { label: "< 4 chars", id: "abc" },
        { label: "4 chars (copy)", id: "ab12" },
        { label: "5 chars (copy + 1 faded)", id: "ab123" },
        { label: "6 chars (copied)", id: "abc123" },
        { label: "7 chars (copied + 1 faded)", id: "abc1234" },
        { label: "12 chars", id: "a1b2c3d4e5f6" },
        { label: "long UUID", id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
      ].map(({ label, id, showValue }) => (
        <div key={label} css={columnCSS} style={{ gap: 4 }}>
          <span css={labelCSS}>{label}</span>
          <CopyableIDBadge id={id} showValue={showValue} />
        </div>
      ))}
    </div>
  ),
};

/**
 * The badge follows the standard badge sizes.
 */
export const Sizes: Story = {
  render: () => (
    <div css={columnCSS}>
      <CopyableIDBadge id="a1b2c3d4e5f6" size="S" />
      <CopyableIDBadge id="a1b2c3d4e5f6" size="M" />
      <CopyableIDBadge id="a1b2c3d4e5f6" size="L" />
    </div>
  ),
};
