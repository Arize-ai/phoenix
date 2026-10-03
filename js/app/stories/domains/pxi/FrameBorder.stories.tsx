import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button, Flex, Text } from "@phoenix/components";
import {
  PxiFrameBorder,
  type PxiFrameBorderState,
  usePxiFrameBorderState,
} from "@phoenix/components/agent";
import { AgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

const meta = {
  title: "Domains/PXI/Frame Border",
  tags: ["updated", "complete", "unreviewed"],
  component: PxiFrameBorder,
  parameters: {
    themeLayout: "column",
    docs: {
      description: {
        component:
          "Animated border around the application viewport while PXI runs a browser-action script. Quick runs read as a glance; runs past one second brighten into the acting state.",
      },
    },
  },
  args: {
    state: "long",
  },
  argTypes: {
    state: {
      control: "inline-radio",
      options: ["idle", "quick", "long"],
    },
  },
} satisfies Meta<typeof PxiFrameBorder>;

export default meta;
type Story = StoryObj<typeof meta>;

const frameCSS = css`
  position: relative;
  isolation: isolate;
  height: 160px;
  overflow: hidden;
  background-color: var(--global-color-gray-75);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

const stateLabelCSS = css`
  text-transform: capitalize;
`;

export const Default: Story = {
  render: (args) => (
    <div css={frameCSS}>
      <PxiFrameBorder {...args} />
    </div>
  ),
};

const frameBorderStates: PxiFrameBorderState[] = ["idle", "quick", "long"];

export const States: Story = {
  render: () => (
    <Flex direction="column" gap="size-200">
      {frameBorderStates.map((state) => (
        <Flex key={state} direction="column" gap="size-100">
          <Text size="XS" color="text-500" css={stateLabelCSS}>
            {state}
          </Text>
          <div css={frameCSS}>
            <PxiFrameBorder state={state} />
          </div>
        </Flex>
      ))}
    </Flex>
  ),
};

type ReplayRun = { toolCallId: string; startMs: number; endMs: number };

const REPLAYS: { label: string; runs: ReplayRun[] }[] = [
  {
    label: "Quick run",
    runs: [{ toolCallId: "quick", startMs: 0, endMs: 120 }],
  },
  {
    label: "Long run",
    runs: [{ toolCallId: "long", startMs: 0, endMs: 3000 }],
  },
  {
    label: "Overlapping runs",
    runs: [
      { toolCallId: "first", startMs: 0, endMs: 700 },
      { toolCallId: "second", startMs: 400, endMs: 2200 },
      { toolCallId: "third", startMs: 2350, endMs: 2500 },
    ],
  },
];

function ReplayControls() {
  const store = useAgentStore();
  const state = usePxiFrameBorderState();
  const [replayCount, setReplayCount] = useState(0);
  const replay = (runs: ReplayRun[]) => {
    const prefix = `replay-${replayCount}`;
    setReplayCount((count) => count + 1);
    for (const run of runs) {
      const toolCallId = `${prefix}-${run.toolCallId}`;
      setTimeout(() => {
        store
          .getState()
          .startBrowserActionRun({ toolCallId, sessionId: "storybook" });
      }, run.startMs);
      setTimeout(() => {
        store.getState().endBrowserActionRun(toolCallId);
      }, run.endMs);
    }
  };
  return (
    <Flex direction="column" gap="size-200">
      <Flex gap="size-100" alignItems="center">
        {REPLAYS.map(({ label, runs }) => (
          <Button key={label} size="S" onPress={() => replay(runs)}>
            {label}
          </Button>
        ))}
        <Text size="XS" color="text-500" css={stateLabelCSS}>
          {state}
        </Text>
      </Flex>
      <div css={frameCSS}>
        <PxiFrameBorder state={state} />
      </div>
    </Flex>
  );
}

function ReplayExample() {
  const [store] = useState(() => createAgentStore());
  return (
    <AgentContext.Provider value={store}>
      <ReplayControls />
    </AgentContext.Provider>
  );
}

export const Replay: Story = {
  render: () => <ReplayExample />,
};
