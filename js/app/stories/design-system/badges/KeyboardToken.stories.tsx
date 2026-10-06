import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { KeyboardToken } from "@phoenix/components/core/KeyboardToken";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A keyboard key or shortcut, drawn as a raised key. Its text is set in
 * uppercase, so `j` and `esc` read as the keys a reader presses.
 *
 * - **default** — a shortcut offered in a tooltip, a menu item or a command
 *   palette footer
 * - **quiet** — a shortcut inside dense chrome, such as the side
 *   navigation's search item, where the raised key would compete with the
 *   labels around it
 */
const meta: Meta = {
  title: "Design System/Badges/Keyboard Token",
  component: KeyboardToken,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const VARIANTS: { label: "default" | "quiet"; code: true }[] = [
  { label: "default", code: true },
  { label: "quiet", code: true },
];

const CONTENT: { label: string; text: string }[] = [
  { label: "Empty", text: "" },
  { label: "Letter", text: "j" },
  { label: "Symbol", text: "↵" },
  { label: "Word", text: "esc" },
  { label: "Chord", text: "⌘⇧K" },
];

export const Default: StoryFn = () => <KeyboardToken>esc</KeyboardToken>;
Default.tags = ["!dev"];

export const VariantsAndContent: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={CONTENT}
    renderCell={(variant, content) => (
      <KeyboardToken variant={variant.label}>{content?.text}</KeyboardToken>
    )}
  />
);
VariantsAndContent.tags = ["!dev"];
VariantsAndContent.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <KeyboardToken>j</KeyboardToken>
      <KeyboardToken>k</KeyboardToken>
      <KeyboardToken>esc</KeyboardToken>
    </div>
  ),
};
