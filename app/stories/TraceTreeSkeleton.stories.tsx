import type { Meta, StoryObj } from "@storybook/react";

import {
  TraceTreeNodeSkeleton,
  TraceTreeSkeleton,
} from "@phoenix/components/trace/TraceTreeSkeleton";

const meta: Meta<typeof TraceTreeSkeleton> = {
  title: "Trace/TraceTreeSkeleton",
  component: TraceTreeSkeleton,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TraceTreeSkeleton>;

const frameCSS = {
  width: 640,
  height: 480,
  border: "1px solid var(--global-border-color-default)",
  background: "var(--ac-global-color-grey-75)",
  overflow: "auto" as const,
};

export const Default: Story = {
  render: () => (
    <div style={frameCSS}>
      <TraceTreeSkeleton />
    </div>
  ),
};

export const Custom: Story = {
  render: () => (
    <div style={frameCSS}>
      <TraceTreeSkeleton>
        <TraceTreeNodeSkeleton nameWidth={240}>
          <TraceTreeNodeSkeleton nameWidth={200}>
            <TraceTreeNodeSkeleton nameWidth={160} />
            <TraceTreeNodeSkeleton nameWidth={140} />
          </TraceTreeNodeSkeleton>
          <TraceTreeNodeSkeleton nameWidth={180} />
        </TraceTreeNodeSkeleton>
      </TraceTreeSkeleton>
    </div>
  ),
};

export const Deep: Story = {
  render: () => (
    <div style={frameCSS}>
      <TraceTreeSkeleton>
        <TraceTreeNodeSkeleton nameWidth={220}>
          <TraceTreeNodeSkeleton nameWidth={200}>
            <TraceTreeNodeSkeleton nameWidth={180}>
              <TraceTreeNodeSkeleton nameWidth={160}>
                <TraceTreeNodeSkeleton nameWidth={140}>
                  <TraceTreeNodeSkeleton nameWidth={120} />
                </TraceTreeNodeSkeleton>
              </TraceTreeNodeSkeleton>
            </TraceTreeNodeSkeleton>
          </TraceTreeNodeSkeleton>
        </TraceTreeNodeSkeleton>
      </TraceTreeSkeleton>
    </div>
  ),
};

export const Flat: Story = {
  render: () => (
    <div style={frameCSS}>
      <TraceTreeSkeleton>
        <TraceTreeNodeSkeleton nameWidth={200} />
        <TraceTreeNodeSkeleton nameWidth={180} />
        <TraceTreeNodeSkeleton nameWidth={220} />
        <TraceTreeNodeSkeleton nameWidth={160} />
        <TraceTreeNodeSkeleton nameWidth={240} />
      </TraceTreeSkeleton>
    </div>
  ),
};

export const MediumWidthHidesTiming: Story = {
  render: () => (
    <div style={{ ...frameCSS, width: 420 }}>
      <TraceTreeSkeleton />
    </div>
  ),
};

export const CompactWidth: Story = {
  render: () => (
    <div style={{ ...frameCSS, width: 260 }}>
      <TraceTreeSkeleton />
    </div>
  ),
};

export const SideBySide: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}
    >
      <div>
        <div style={{ marginBottom: 8, fontSize: 12 }}>Wide (640px)</div>
        <div style={frameCSS}>
          <TraceTreeSkeleton />
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 8, fontSize: 12 }}>Medium (420px)</div>
        <div style={{ ...frameCSS, width: 420 }}>
          <TraceTreeSkeleton />
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 8, fontSize: 12 }}>Compact (260px)</div>
        <div style={{ ...frameCSS, width: 260 }}>
          <TraceTreeSkeleton />
        </div>
      </div>
    </div>
  ),
};
