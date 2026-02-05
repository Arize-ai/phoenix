import { Meta, StoryFn } from "@storybook/react";

import { SpanKindIcon } from "@phoenix/components/trace";

const meta: Meta = {
  title: "SpanKindIcon",
  component: SpanKindIcon,
  parameters: {
    docs: {
      description: {
        component: `
Icons representing different span kinds in trace views.

**Note:** Currently only the \`fill\` variant is used in the codebase (TraceTree, SpanDetails, PlaygroundTool).
The \`outline\` variant exists but is not used anywhere in production.
        `,
      },
    },
  },
};

export default meta;

const SPAN_KINDS = [
  "llm",
  "chain",
  "retriever",
  "embedding",
  "agent",
  "tool",
  "reranker",
  "evaluator",
  "guardrail",
  "prompt",
  "unknown",
] as const;

function SpanKindIconList() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "20px",
      }}
    >
      {SPAN_KINDS.map((spanKind) => (
        <div
          key={spanKind}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <SpanKindIcon spanKind={spanKind} variant="fill" />
          <SpanKindIcon spanKind={spanKind} variant="outline" />
          <span
            style={{
              fontSize: "13px",
              color: "var(--ac-global-text-color-900)",
            }}
          >
            {spanKind}
          </span>
        </div>
      ))}
    </div>
  );
}

const Template: StoryFn = () => <SpanKindIconList />;

export const Default = Template.bind({});

Default.args = {};
