import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  DOCS_FILESYSTEM_QUERY_TOOL_NAME,
  DOCS_SEARCH_TOOL_NAME,
} from "@phoenix/agent/tools/docs";
import {
  ToolPart,
  type ToolPartType,
} from "@phoenix/components/agent/ToolPart";
import { Heading } from "@phoenix/components/core/content";
import { View } from "@phoenix/components/core/view";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

function AgentStoreStoryProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createAgentStore());

  return (
    <AgentContext.Provider value={store}>{children}</AgentContext.Provider>
  );
}

/**
 * Build a mock tool part. We cast through `unknown` because the
 * `ToolPartType` union is complex—in real code only the AI SDK constructs
 * these, but stories only need valid display shapes.
 */
function makePart(overrides: Record<string, unknown>): ToolPartType {
  return {
    type: "dynamic-tool",
    toolCallId: crypto.randomUUID(),
    input: undefined,
    ...overrides,
  } as unknown as ToolPartType;
}

const toolIconItems = [
  {
    label: "Ask",
    part: makePart({
      toolName: "ask_user",
      state: "input-available",
      input: {
        questions: [
          {
            id: "project",
            type: "single",
            prompt: "Which project should I inspect?",
            options: [
              {
                id: "production",
                label: "Production",
                description: "Inspect the production traces.",
              },
              {
                id: "staging",
                label: "Staging",
                description: "Inspect the staging traces.",
              },
            ],
          },
        ],
      },
    }),
  },
  {
    label: "Command",
    part: makePart({
      toolName: "bash",
      state: "input-available",
      input: {
        command: "phoenix-gql --query-file /tmp/slow-traces.graphql",
        summary: "Query slow traces",
      },
    }),
  },
  {
    label: "Configure",
    part: makePart({
      toolName: "set_playground_model",
      state: "input-available",
      input: {
        instanceId: 0,
        target: {
          type: "builtin",
          provider: "OPENAI",
          modelName: "gpt-4.1-mini",
        },
      },
    }),
  },
  {
    label: "Data",
    part: makePart({
      toolName: "list_datasets",
      state: "input-available",
      input: { nameContains: "support", limit: 20 },
    }),
  },
  {
    label: "Delegate",
    part: makePart({
      toolName: "call_subagent",
      state: "input-available",
      input: {
        name: "trace-analyst",
        task: "Summarize the dominant latency bottleneck.",
      },
    }),
  },
  {
    label: "Docs",
    part: makePart({
      toolName: DOCS_FILESYSTEM_QUERY_TOOL_NAME,
      state: "input-available",
      input: {
        command: 'rg -n "session annotations" docs/',
      },
    }),
  },
  {
    label: "Edit",
    part: makePart({
      toolName: "batch_span_annotate",
      state: "input-available",
      input: {
        annotations: [
          {
            spanId: "f4d0c2a6b7319e12",
            name: "failure_mode",
            label: "retrieval",
            explanation: "The retriever returned no relevant documents.",
          },
        ],
      },
    }),
  },
  {
    label: "Filter",
    part: makePart({
      toolName: "set_spans_filter",
      state: "input-available",
      input: {
        condition: "status_code == 'ERROR' and latency_ms > 2000",
        rootSpansOnly: false,
      },
    }),
  },
  {
    label: "Navigate",
    part: makePart({
      toolName: "get_route_info",
      state: "input-available",
      input: { query: "project spans", limit: 5 },
    }),
  },
  {
    label: "Read",
    part: makePart({
      toolName: "read_prompt_tools",
      state: "input-available",
      input: { instanceId: 0 },
    }),
  },
  {
    label: "Run",
    part: makePart({
      toolName: "run_playground",
      state: "input-available",
      input: {},
    }),
  },
  {
    label: "Search",
    part: makePart({
      toolName: DOCS_SEARCH_TOOL_NAME,
      state: "input-available",
      input: { query: "How do I compare Phoenix experiments?" },
    }),
  },
  {
    label: "Skill",
    part: makePart({
      toolName: "load_skill",
      state: "input-available",
      input: { skill_name: "third-party-skill" },
    }),
  },
  {
    label: "Time",
    part: makePart({
      toolName: "set_time_range",
      state: "input-available",
      input: {
        timeRangeKey: "custom",
        startTime: "2026-07-22T00:00:00Z",
        endTime: "2026-07-23T00:00:00Z",
      },
    }),
  },
  {
    label: "Visualize",
    part: makePart({
      toolName: "render_generative_ui",
      state: "input-available",
      input: {
        spec: {
          root: "errors-by-model",
          elements: {
            "errors-by-model": {
              type: "BarChart",
              props: {
                title: "Errors by model",
                data: [
                  { label: "GPT-4.1", value: 12 },
                  { label: "Claude Sonnet", value: 7 },
                ],
              },
              children: [],
            },
          },
        },
        state: {},
      },
    }),
  },
  {
    label: "Web",
    part: makePart({
      toolName: "web_fetch",
      state: "input-available",
      input: { url: "https://opentelemetry.io/docs/specs/otel/trace/" },
    }),
  },
  {
    label: "Default",
    part: makePart({
      toolName: "lookup_weather",
      state: "input-available",
      input: { location: "San Francisco, CA", units: "fahrenheit" },
    }),
  },
] satisfies Array<{ label: string; part: ToolPartType }>;

const builtInSkillIconItems = [
  "annotate-spans",
  "datasets",
  "debug-trace",
  "evaluators",
  "experiments",
  "phoenix-graphql",
  "playground",
  "span-coding",
].map((skillName) => ({
  skillName,
  part: makePart({
    toolName: "load_skill",
    state: "input-available",
    input: { skill_name: skillName },
  }),
}));

const meta = {
  title: "Agent/ToolPart",
  component: ToolPart,
  tags: ["!autodocs"],
  args: { part: toolIconItems[0].part, defaultOpen: false },
  decorators: [
    (Story) => (
      <AgentStoreStoryProvider>
        <div css={containerCSS}>
          <Story />
        </div>
      </AgentStoreStoryProvider>
    ),
  ],
  parameters: {
    contentMaxWidth: 780,
    contentMode: "bounded",
    layout: "padded",
  },
} satisfies Meta<typeof ToolPart>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tool icons and fallback, followed by the built-in skill icons. */
export const ToolAndSkillIcons: Story = {
  name: "Tool and Skill Icons",
  render: () => (
    <div>
      <View marginBottom="size-100">
        <Heading level={4} weight="heavy">
          Tools
        </Heading>
      </View>
      {toolIconItems.map(({ label, part }) => (
        <ToolPart key={label} part={part} defaultOpen={false} />
      ))}
      <View marginTop="size-200" marginBottom="size-100">
        <Heading level={4} weight="heavy">
          Skills
        </Heading>
      </View>
      {builtInSkillIconItems.map(({ skillName, part }) => (
        <ToolPart key={skillName} part={part} defaultOpen={false} />
      ))}
    </div>
  ),
};
