import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import { CopyId } from "../src/components/core/copy/CopyId";
import type { CopyIdProps } from "../src/components/core/copy/CopyId";

const meta: Meta = {
  title: "Core/Actions/CopyId",
  component: CopyId,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["text", "title"],
    },
    truncate: {
      control: { type: "number" },
    },
  },
};

export default meta;

const Template: StoryFn<CopyIdProps> = (args) => <CopyId {...args} />;

/**
 * Default text variant for use in table cells or inline contexts.
 */
export const TextVariant = Template.bind({});

TextVariant.args = {
  id: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
  variant: "text",
};

/**
 * Title variant for use in dialog headings or section titles.
 */
export const TitleVariant = Template.bind({});

TitleVariant.args = {
  id: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
  variant: "title",
};

/**
 * Truncated to 12 characters.
 */
export const Truncated = Template.bind({});

Truncated.args = {
  id: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
  truncate: 12,
  variant: "text",
};

/**
 * Truncation is clamped to a minimum of 6 characters so "copied" always fits.
 */
export const MinTruncation = Template.bind({});

MinTruncation.args = {
  id: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
  truncate: 3,
  variant: "text",
};

/**
 * Short ID that does not require truncation.
 */
export const ShortId = Template.bind({});

ShortId.args = {
  id: "abc123",
  variant: "text",
};

/**
 * Demonstrates that the component maintains layout stability during the
 * "copied" state — the original text continues to occupy space while the
 * "copied" label is overlaid.
 */
export const LayoutStability = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-200);
      border: 1px dashed var(--global-text-color-300);
      padding: var(--global-dimension-size-200);
      width: 400px;
    `}
  >
    <span
      css={css`
        font-size: var(--global-font-size-xs);
        color: var(--global-text-color-500);
      `}
    >
      Click the IDs below — notice the surrounding content does not shift.
    </span>
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <span>Session:</span>
      <CopyId id="sess-abc123def456ghi789" truncate={16} />
    </div>
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <span>Trace:</span>
      <CopyId id="trace-deadbeef-cafe-babe" truncate={16} />
    </div>
  </div>
);

/**
 * Title variant in a realistic heading context — hover to reveal the bordered
 * copy button at the end of the ID.
 */
export const TitleInHeading = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-300);
    `}
  >
    <h2
      css={css`
        margin: 0;
        font-size: var(--global-font-size-xl);
      `}
    >
      Project: <CopyId id="my-llm-project" variant="title" />
    </h2>
    <h3
      css={css`
        margin: 0;
        font-size: var(--global-font-size-l);
      `}
    >
      Version:{" "}
      <CopyId
        id="c1b2a3d4-e5f6-7890-abcd-ef1234567890"
        variant="title"
        truncate={12}
      />
    </h3>
  </div>
);

/**
 * Side-by-side comparison of both variants.
 */
export const VariantComparison = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-300);
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
      `}
    >
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Text variant (table cell)
      </span>
      <CopyId
        id="c1b2a3d4-e5f6-7890-abcd-ef1234567890"
        truncate={16}
        variant="text"
      />
    </div>
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
      `}
    >
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Title variant (dialog heading)
      </span>
      <CopyId
        id="c1b2a3d4-e5f6-7890-abcd-ef1234567890"
        truncate={16}
        variant="title"
      />
    </div>
  </div>
);
