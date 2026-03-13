import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import { CopyButton } from "../src/components/core/copy/CopyButton";
import type { CopyButtonProps } from "../src/components/core/copy/CopyButton";

const meta: Meta = {
  title: "Core/Actions/CopyButton",
  component: CopyButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<CopyButtonProps> = (args) => <CopyButton {...args} />;

/**
 * Icon-only copy button. Copies the provided text on click and briefly shows a
 * checkmark.
 */
export const IconOnly = Template.bind({});

IconOnly.args = {
  text: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
};

/**
 * Copy button with a "Copy" label.
 */
export const WithLabel = Template.bind({});

WithLabel.args = {
  text: "c1b2a3d4-e5f6-7890-abcd-ef1234567890",
  children: "Copy",
};

/**
 * Copy button with a custom "Copy link" label.
 */
export const CopyLink = Template.bind({});

CopyLink.args = {
  text: "https://app.phoenix.arize.com/traces/abc123",
  children: "Copy link",
};

/**
 * Size comparison between Small and Medium copy buttons.
 */
export const Sizes = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-300);
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <CopyButton text="small" size="S" />
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Small (icon)
      </span>
    </div>
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <CopyButton text="medium" size="M" />
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Medium (icon)
      </span>
    </div>
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <CopyButton text="small" size="S">
        Copy
      </CopyButton>
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Small (labeled)
      </span>
    </div>
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <CopyButton text="medium" size="M">
        Copy
      </CopyButton>
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Medium (labeled)
      </span>
    </div>
  </div>
);
