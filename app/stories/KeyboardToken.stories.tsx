import type { Meta, StoryObj } from "@storybook/react";

import { KeyboardToken } from "../src/components/KeyboardToken";

/**
 * KeyboardToken visually represents a keyboard key or shortcut, styled to look like a keyboard key.
 * Useful for documentation, tooltips, or UI hints where you want to show keyboard commands.
 *
 * ## Usage
 * ```tsx
 * <KeyboardToken>⌘</KeyboardToken>
 * <KeyboardToken>Ctrl</KeyboardToken>
 * <KeyboardToken>Shift + Enter</KeyboardToken>
 * ```
 *
 * ## Features
 * - Styled with design tokens for consistency
 * - Supports custom children (text or symbols)
 * - Can be used inline with text
 */
const meta: Meta<typeof KeyboardToken> = {
  title: "Content/KeyboardToken",
  component: KeyboardToken,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A component for displaying keyboard keys or shortcuts in a visually distinct way.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "text",
      description: "The key or shortcut to display",
      table: {
        type: { summary: "ReactNode" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof KeyboardToken>;

/**
 * Default usage with a single key.
 */
export const Default: Story = {
  args: {
    children: "⌘",
  },
};

/**
 * Shows a common keyboard shortcut.
 */
export const Shortcut: Story = {
  args: {
    children: "Ctrl + S",
  },
};

/**
 * Shows a multi-key combination.
 */
export const MultiKey: Story = {
  args: {
    children: "Shift + Enter",
  },
};

/**
 * Shows the component inline with text.
 */
export const InlineWithText: Story = {
  render: (args) => (
    <span>
      Press <KeyboardToken {...args} /> to save your work.
    </span>
  ),
  args: {
    children: "Ctrl + S",
  },
};
