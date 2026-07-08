import type { Meta, StoryFn } from "@storybook/react";
import { useCallback, useState } from "react";

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

export const Default = {
  args: {},
};

export const FromStartTime = {
  args: {
    startTime: new Date(Date.now() - 5 * 60 * 1000),
  },
};

export const WithHours = {
  args: {
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000),
  },
};

export const SubtleColor = {
  args: {
    color: "text-700",
  },
};

export const MutedColor = {
  args: {
    color: "text-500",
    startTime: new Date(Date.now() - 30 * 1000),
  },
};

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
