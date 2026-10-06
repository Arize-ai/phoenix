import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Counter } from "@phoenix/components";
import type { CounterProps } from "@phoenix/components/core/counter";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The count of something, set beside the label it counts: a tab, a card
 * title, a navigation item, a filter button.
 *
 * - **default** — a count the reader should notice
 * - **danger** — a count of failures, such as a span's exceptions
 * - **quiet** — a count that recedes into dense chrome, such as the side
 *   navigation, or a count of zero
 */
const meta: Meta = {
  title: "Design System/Badges/Counter",
  component: Counter,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const VARIANTS: {
  label: NonNullable<CounterProps["variant"]>;
  code: true;
}[] = [
  { label: "default", code: true },
  { label: "danger", code: true },
  { label: "quiet", code: true },
];

const LENGTHS: { label: string; text: string }[] = [
  { label: "Empty", text: "" },
  { label: "1 character", text: "7" },
  { label: "Regular", text: "128" },
  { label: "Long", text: "1048576" },
];

const FORMATS: { label: string; text: string }[] = [
  { label: "Count", text: "42" },
  { label: "Position", text: "#3" },
  { label: "Abbreviated", text: "9.2k" },
  { label: "Unknown", text: "--" },
];

export const Default: StoryFn = () => <Counter>12</Counter>;
Default.tags = ["!dev"];

export const VariantsAndContentLength: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={LENGTHS}
    renderCell={(variant, length) => (
      <Counter variant={variant.label}>{length?.text}</Counter>
    )}
  />
);
VariantsAndContentLength.tags = ["!dev"];
VariantsAndContentLength.parameters = { themeLayout: "column" };

export const Formats: StoryFn = () => (
  <OptionGrid
    rows={FORMATS}
    renderCell={(format) => <Counter>{format.text}</Counter>}
  />
);
Formats.tags = ["!dev"];
Formats.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Counter>9</Counter>
      <Counter variant="danger">12,000</Counter>
      <Counter variant="quiet">1.2k</Counter>
    </div>
  ),
};
