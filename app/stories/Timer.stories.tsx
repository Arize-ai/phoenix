import type { Meta, StoryFn } from "@storybook/react";
import { useCallback, useState } from "react";

import type { TimerProps } from "@phoenix/components";
import { Timer } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Feedback/Timer",
  component: Timer,
  parameters: {
    layout: "centered",
    // Timer is inherently dynamic; disable chromatic snapshots by default
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

const Template: StoryFn<TimerProps> = (args) => <Timer {...args} />;

/**
 * Default timer counting from mount time in MM:SS format
 */
export const Default = Template.bind({});

Default.args = {};

/**
 * Timer counting elapsed time from a start time 5 minutes ago
 */
export const FromStartTime = Template.bind({});

FromStartTime.args = {
  startTime: new Date(Date.now() - 5 * 60 * 1000),
};

/**
 * Timer that has been running for over an hour, automatically shows HH:MM:SS
 */
export const WithHours = Template.bind({});

WithHours.args = {
  startTime: new Date(Date.now() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000),
};

/**
 * Timer with text-700 color
 */
export const SubtleColor = Template.bind({});

SubtleColor.args = {
  color: "text-700",
};

/**
 * Timer with text-500 color
 */
export const MutedColor = Template.bind({});

MutedColor.args = {
  color: "text-500",
  startTime: new Date(Date.now() - 30 * 1000),
};

/**
 * All available sizes
 */
export const Sizes: StoryFn = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {(["XS", "S", "M", "L", "XL", "XXL"] as const).map((size) => (
      <div key={size} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 32, fontFamily: "monospace" }}>{size}</span>
        <Timer size={size} startTime={new Date(Date.now() - 90 * 1000)} />
      </div>
    ))}
  </div>
);

/**
 * Interactive example with start/reset controls
 */
export const Interactive: StoryFn = () => {
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [running, setRunning] = useState(false);

  const handleStart = useCallback(() => {
    setStartTime(new Date());
    setRunning(true);
  }, []);

  const handleReset = useCallback(() => {
    setStartTime(undefined);
    setRunning(false);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Timer startTime={startTime} />
      {!running ? (
        <button onClick={handleStart}>Start</button>
      ) : (
        <button onClick={handleReset}>Reset</button>
      )}
    </div>
  );
};
