import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  TraceTree,
  TraceTreeProvider,
} from "@phoenix/components/trace/TraceTree";
import { traceTreePanelContentCSS } from "@phoenix/components/trace/traceTreeStyles";
import type { ISpanItem } from "@phoenix/components/trace/types";

const DEFAULT_TRACE_START_TIME_MS = Date.parse("2026-07-28T16:00:00.000Z");
const SECOND_LEVEL_ACTIONS = [
  "Plan response",
  "Retrieve context",
  "Call language model",
  "Check policy",
  "Record result",
] as const;
const SECOND_LEVEL_KINDS = [
  "chain",
  "retriever",
  "llm",
  "evaluator",
  "tool",
] as const;
const THIRD_LEVEL_ACTIONS = [
  "Load prompt template",
  "Fetch conversation context",
  "Run model inference",
  "Parse tool output",
  "Store span attributes",
] as const;
const THIRD_LEVEL_KINDS = [
  "prompt",
  "retriever",
  "llm",
  "tool",
  "chain",
] as const;

function getStoryTimestamp({
  offsetMs,
  startTimeMs = DEFAULT_TRACE_START_TIME_MS,
}: {
  offsetMs: number;
  startTimeMs?: number;
}) {
  return new Date(startTimeMs + offsetMs).toISOString();
}

const ROOT_SPAN: ISpanItem = {
  id: "story-root-span-node",
  name: "Handle customer support request",
  spanKind: "agent",
  statusCode: "OK",
  latencyMs: 120_000,
  startTime: getStoryTimestamp({ offsetMs: 0 }),
  endTime: getStoryTimestamp({ offsetMs: 120_000 }),
  parentId: null,
  spanId: "story-root-span",
  tokenCountTotal: 18_400,
};

const SECOND_LEVEL_SPANS: ISpanItem[] = Array.from(
  { length: 25 },
  (_value, childIndex) => {
    const startOffsetMs = (childIndex + 1) * 3_000;
    return {
      id: `story-child-span-node-${childIndex + 1}`,
      name: `${SECOND_LEVEL_ACTIONS[childIndex % SECOND_LEVEL_ACTIONS.length]} ${String(childIndex + 1).padStart(2, "0")}`,
      spanKind:
        SECOND_LEVEL_KINDS[childIndex % SECOND_LEVEL_KINDS.length] ?? "chain",
      statusCode: "OK",
      latencyMs: 2_500,
      startTime: getStoryTimestamp({ offsetMs: startOffsetMs }),
      endTime: getStoryTimestamp({ offsetMs: startOffsetMs + 2_500 }),
      parentId: ROOT_SPAN.spanId,
      spanId: `story-child-span-${childIndex + 1}`,
      tokenCountTotal: childIndex % 5 === 2 ? 1_200 + childIndex * 10 : null,
    };
  }
);

const THIRD_LEVEL_SPANS: ISpanItem[] = SECOND_LEVEL_SPANS.flatMap(
  (parentSpan, childIndex) =>
    Array.from({ length: 15 }, (_value, grandchildIndex) => {
      const parentStartOffsetMs = (childIndex + 1) * 3_000;
      const startOffsetMs = parentStartOffsetMs + (grandchildIndex + 1) * 125;
      return {
        id: `story-grandchild-span-node-${childIndex + 1}-${grandchildIndex + 1}`,
        name: `${THIRD_LEVEL_ACTIONS[grandchildIndex % THIRD_LEVEL_ACTIONS.length]} ${childIndex + 1}.${grandchildIndex + 1}`,
        spanKind:
          THIRD_LEVEL_KINDS[grandchildIndex % THIRD_LEVEL_KINDS.length] ??
          "chain",
        statusCode: "OK",
        latencyMs: 90,
        startTime: getStoryTimestamp({ offsetMs: startOffsetMs }),
        endTime: getStoryTimestamp({ offsetMs: startOffsetMs + 90 }),
        parentId: parentSpan.spanId,
        spanId: `story-grandchild-span-${childIndex + 1}-${grandchildIndex + 1}`,
        tokenCountTotal:
          grandchildIndex % 5 === 2 ? 240 + grandchildIndex * 5 : null,
      } satisfies ISpanItem;
    })
);

const TRACE_TREE_SPANS = [
  ROOT_SPAN,
  ...SECOND_LEVEL_SPANS,
  ...THIRD_LEVEL_SPANS,
];

const storyFrameCSS = css`
  width: 640px;
  height: 720px;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  background: var(--global-background-color-default);
`;

function InteractiveTraceTree({ spans }: { spans: ISpanItem[] }) {
  const [selectedSpanNodeId, setSelectedSpanNodeId] = useState(ROOT_SPAN.id);
  return (
    <TraceTreeProvider>
      <div css={[traceTreePanelContentCSS, storyFrameCSS]}>
        <TraceTree
          spans={spans}
          isChildTruncationEnabled
          selectedSpanNodeId={selectedSpanNodeId}
          scrollSelectedSpanIntoView={false}
          onSpanClick={(span) => setSelectedSpanNodeId(span.id)}
        />
      </div>
    </TraceTreeProvider>
  );
}

const meta: Meta<typeof TraceTree> = {
  title: "Trace/TraceTree",
  component: TraceTree,
  parameters: {
    layout: "centered",
    themeLayout: "column",
  },
};

export default meta;
type Story = StoryObj<typeof TraceTree>;

export const LargeNestedTree: Story = {
  args: {
    spans: TRACE_TREE_SPANS,
    isChildTruncationEnabled: true,
    selectedSpanNodeId: ROOT_SPAN.id,
    scrollSelectedSpanIntoView: false,
  },
  render: (args) => <InteractiveTraceTree spans={args.spans} />,
};
