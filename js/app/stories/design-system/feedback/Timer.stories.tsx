import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Button, Flex, Timer } from "@phoenix/components";
import type { TextColorValue, TextSize } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The time elapsed since `startTime`, counting up once a second, as
 * `mm:ss` under an hour and `hh:mm:ss` after. Without a `startTime` it counts
 * from when it mounts, which is how the playground times a running
 * experiment: the timer appears when the run starts.
 */
const meta: Meta = {
  title: "Design System/Feedback/Timer",
  component: Timer,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const now = Date.now();

const ELAPSED: { label: string; startTime: Date }[] = [
  { label: "Just started", startTime: new Date(now) },
  { label: "30 seconds", startTime: new Date(now - 30 * SECOND) },
  { label: "5 minutes", startTime: new Date(now - 5 * MINUTE) },
  {
    label: "2 hours 15 minutes",
    startTime: new Date(now - 2 * HOUR - 15 * MINUTE),
  },
  { label: "120 hours", startTime: new Date(now - 120 * HOUR) },
];

const SIZES: { label: TextSize; code: true }[] = (
  ["XS", "S", "M", "L", "XL", "XXL"] as const
).map((size) => ({ label: size, code: true }));

const COLORS: { label: TextColorValue; code: true }[] = [
  { label: "text-900", code: true },
  { label: "text-700", code: true },
  { label: "text-500", code: true },
];

const NINETY_SECONDS_AGO = new Date(now - 90 * SECOND);

export const Default: StoryFn = () => <Timer size="S" color="text-700" />;
Default.tags = ["!dev"];

export const Elapsed: StoryFn = () => (
  <OptionGrid
    rows={ELAPSED}
    renderCell={(elapsed) => <Timer startTime={elapsed.startTime} />}
  />
);
Elapsed.tags = ["!dev"];
Elapsed.parameters = { themeLayout: "row" };

export const SizesAndColors: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    columns={COLORS}
    renderCell={(size, color) => (
      <Timer
        startTime={NINETY_SECONDS_AGO}
        size={size.label}
        color={color?.label}
      />
    )}
  />
);
SizesAndColors.tags = ["!dev"];
SizesAndColors.parameters = { themeLayout: "column" };

export const Interaction: StoryFn = () => {
  const [isRunning, setIsRunning] = useState(false);
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Button size="S" onPress={() => setIsRunning((running) => !running)}>
        {isRunning ? "Stop" : "Run"}
      </Button>
      {isRunning ? <Timer size="S" color="text-700" /> : null}
    </Flex>
  );
};
Interaction.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <Timer startTime={new Date(now - 2 * HOUR - 15 * MINUTE)} size="XXL" />
);
Thumbnail.tags = ["!dev", "!autodocs"];
