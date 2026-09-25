import type { Meta, StoryFn } from "@storybook/react";

import { ProgressCircle } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A circular progress indicator. Set `isIndeterminate` while an operation of
 * unknown length runs, such as generating an output or testing credentials,
 * usually at `S` beside a label. Pass a `value` from 0 to 100 when the share
 * complete is known, as a playground run's progress does.
 */
const meta: Meta = {
  title: "Design System/Feedback/Progress Circle",
  component: ProgressCircle,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const PROGRESS: { label: string; code: true; value?: number }[] = [
  { label: "0", code: true, value: 0 },
  { label: "25", code: true, value: 25 },
  { label: "75", code: true, value: 75 },
  { label: "100", code: true, value: 100 },
  { label: "isIndeterminate", code: true },
];

const SIZES: { label: "S" | "M"; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

export const Default: StoryFn = () => (
  <ProgressCircle isIndeterminate size="S" aria-label="Generating" />
);
Default.tags = ["!dev"];

export const ProgressAndSizes: StoryFn = () => (
  <OptionGrid
    rows={PROGRESS}
    columns={SIZES}
    justifyCells="center"
    renderCell={(progress, size) => (
      <ProgressCircle
        value={progress.value}
        isIndeterminate={progress.value === undefined}
        size={size?.label}
        aria-label="Progress"
      />
    )}
  />
);
ProgressAndSizes.tags = ["!dev"];
ProgressAndSizes.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
    <ProgressCircle value={75} size="S" aria-label="Progress" />
    <ProgressCircle value={75} size="M" aria-label="Progress" />
  </div>
);
Thumbnail.tags = ["!dev", "!autodocs"];
