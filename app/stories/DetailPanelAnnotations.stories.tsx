import type { Meta, StoryObj } from "@storybook/react";

import {
  SpanAnnotations,
  type SpanAnnotation,
} from "@phoenix/pages/trace/SpanFeedback";

import {
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const now = "2026-07-23T16:00:00.000Z";

const annotations: SpanAnnotation[] = [
  {
    annotatorKind: "HUMAN",
    createdAt: now,
    explanation: "The response directly answers the question.",
    id: "annotation-human",
    identifier: "alice-review",
    label: "helpful",
    metadata: null,
    name: "user feedback",
    score: null,
    source: "APP",
    updatedAt: now,
    user: {
      id: "user-alice",
      profilePictureUrl: null,
      username: "alice",
    },
  },
  {
    annotatorKind: "LLM",
    createdAt: "2026-07-23T16:01:00.000Z",
    explanation: null,
    id: "annotation-llm",
    identifier: "gpt-judge-v4",
    label: null,
    metadata: { model: "gpt-4.1", promptVersion: 4 },
    name: "correctness",
    score: 0.93,
    source: "API",
    updatedAt: "2026-07-23T16:01:00.000Z",
    user: null,
  },
  {
    annotatorKind: "CODE",
    createdAt: "2026-07-23T16:02:00.000Z",
    explanation: "Matched 8 of 10 required facts.",
    id: "annotation-code",
    identifier: "facts-v2",
    label: "pass",
    metadata: null,
    name: "fact coverage",
    score: 0.8,
    source: "API",
    updatedAt: "2026-07-23T16:02:00.000Z",
    user: {
      id: "user-ci",
      profilePictureUrl: null,
      username: "evaluation-bot",
    },
  },
];

const kitchenSinkAnnotation: SpanAnnotation = {
  annotatorKind: "LLM",
  createdAt: "2026-07-23T16:03:00.000Z",
  explanation:
    "This deliberately long explanation exercises the widest table column and includes enough detail to make truncation, wrapping, and horizontal scrolling obvious in the component documentation.",
  id: "annotation-kitchen-sink",
  identifier:
    "production-rubric-correctness-v17-shadow-deployment-us-west-2-2026-07-23",
  label: "mostly_correct_with_minor_caveats",
  metadata: {
    evaluator: {
      model: "provider/model-with-a-needlessly-long-name",
      promptVersion: "2026-07-23.17",
      retries: 3,
      thresholds: { pass: 0.8, warn: 0.65 },
    },
    tags: ["nightly", "shadow", "high-priority", "customer-visible"],
    nested: { one: { two: { three: "maximum detail" } } },
  },
  name: "an excessively descriptive annotation name for layout stress testing",
  score: 0.87654321,
  source: "API",
  updatedAt: "2026-07-23T18:45:12.345Z",
  user: {
    id: "user-obnoxiously-specific",
    profilePictureUrl: "https://example.com/avatar-with-a-long-path.png",
    username: "principal-evaluation-engineer-with-a-long-display-name",
  },
};

const meta = {
  title: "Detail panel/Annotations",
  component: SpanAnnotations,
  parameters: {
    width: "overflow",
  },
} satisfies Meta<typeof SpanAnnotations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: {
    annotations,
    spanNodeId: "span-node-storybook",
    showActions: false,
  },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty">
        <SpanAnnotations
          annotations={[]}
          spanNodeId="span-node-empty"
          showActions={false}
        />
      </DetailPanelExample>
      <DetailPanelExample
        title="Every annotator kind"
        description="Human, LLM, and code annotations mix users and optional score, label, explanation, and metadata fields."
      >
        <SpanAnnotations
          annotations={annotations}
          spanNodeId="span-node-every-kind"
          showActions={false}
        />
      </DetailPanelExample>
      <DetailPanelExample title="Kitchen sink">
        <SpanAnnotations
          annotations={[kitchenSinkAnnotation]}
          spanNodeId="span-node-kitchen-sink"
          showActions={false}
        />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
