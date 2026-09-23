import type { Meta, StoryObj } from "@storybook/react";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";

import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundOutputHeader } from "@phoenix/pages/playground/PlaygroundOutputHeader";
import { createPlaygroundStore, type PlaygroundStore } from "@phoenix/store";

const TOTAL_RUNS = 10;
const STORY_PROGRESS_INTERVAL_MS = 800;

function createStoryPlayground({
  errorCount,
  isRunning = false,
}: {
  errorCount: number;
  isRunning?: boolean;
}) {
  const playgroundStore = createPlaygroundStore({ modelConfigByProvider: {} });
  const instance = playgroundStore.getState().instances[0];
  if (instance == null) {
    throw new Error("Expected the playground store to create an instance");
  }
  playgroundStore.setState({
    instances: [
      {
        ...instance,
        activeRunId: isRunning ? 1 : null,
        experimentRunProgress: {
          totalRuns: TOTAL_RUNS,
          runsCompleted: isRunning ? 3 : TOTAL_RUNS - errorCount,
          runsFailed: errorCount,
          totalEvals: 0,
          evalsCompleted: 0,
          evalsFailed: 0,
        },
      },
    ],
  });
  return { instanceId: instance.id, playgroundStore };
}

function RunningPlaygroundProvider({
  children,
  errorCount,
  instanceId,
  playgroundStore,
}: PropsWithChildren<{
  errorCount: number;
  instanceId: number;
  playgroundStore: PlaygroundStore;
}>) {
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      playgroundStore.setState((state) => ({
        instances: state.instances.map((instance) => {
          if (instance.id !== instanceId) {
            return instance;
          }
          const progress = instance.experimentRunProgress;
          if (progress == null) {
            return instance;
          }
          const lastRunningCompletedCount = TOTAL_RUNS - errorCount - 1;
          const runsCompleted =
            progress.runsCompleted >= lastRunningCompletedCount
              ? 0
              : progress.runsCompleted + 1;
          return {
            ...instance,
            experimentRunProgress: {
              ...progress,
              runsCompleted,
            },
          };
        }),
      }));
    }, STORY_PROGRESS_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [errorCount, instanceId, playgroundStore]);

  return (
    <PlaygroundContext.Provider value={playgroundStore}>
      {children}
    </PlaygroundContext.Provider>
  );
}

const idlePlayground = createStoryPlayground({ errorCount: 0 });
const completedWithErrorsPlayground = createStoryPlayground({ errorCount: 3 });
const runningWithoutErrorsPlayground = createStoryPlayground({
  errorCount: 0,
  isRunning: true,
});
const runningWithErrorsPlayground = createStoryPlayground({
  errorCount: 2,
  isRunning: true,
});

const meta = {
  title: "Playground/Output Header",
  component: PlaygroundOutputHeader,
  parameters: {
    width: 560,
  },
} satisfies Meta<typeof PlaygroundOutputHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    instanceId: idlePlayground.instanceId,
    index: 0,
  },
  decorators: [
    (Story) => (
      <PlaygroundContext.Provider value={idlePlayground.playgroundStore}>
        <Story />
      </PlaygroundContext.Provider>
    ),
  ],
};

export const CompletedWithErrors: Story = {
  args: {
    instanceId: completedWithErrorsPlayground.instanceId,
    index: 0,
  },
  decorators: [
    (Story) => (
      <PlaygroundContext.Provider
        value={completedWithErrorsPlayground.playgroundStore}
      >
        <Story />
      </PlaygroundContext.Provider>
    ),
  ],
};

export const RunningWithoutErrors: Story = {
  args: {
    instanceId: runningWithoutErrorsPlayground.instanceId,
    index: 0,
  },
  decorators: [
    (Story) => (
      <RunningPlaygroundProvider
        errorCount={0}
        instanceId={runningWithoutErrorsPlayground.instanceId}
        playgroundStore={runningWithoutErrorsPlayground.playgroundStore}
      >
        <Story />
      </RunningPlaygroundProvider>
    ),
  ],
};

export const RunningWithErrors: Story = {
  args: {
    instanceId: runningWithErrorsPlayground.instanceId,
    index: 0,
  },
  decorators: [
    (Story) => (
      <RunningPlaygroundProvider
        errorCount={2}
        instanceId={runningWithErrorsPlayground.instanceId}
        playgroundStore={runningWithErrorsPlayground.playgroundStore}
      >
        <Story />
      </RunningPlaygroundProvider>
    ),
  ],
};
