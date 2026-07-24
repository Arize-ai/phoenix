import type { Meta, StoryObj } from "@storybook/react";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  LinkButton,
  ToggleButton,
  View,
} from "@phoenix/components";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";
import type { SpanKind } from "@phoenix/pages/__generated__/SpanHeader_span.graphql";
import {
  SpanHeaderContent,
  type SpanHeaderData,
} from "@phoenix/pages/SpanHeader";

import { DetailPanelExamples } from "./detailPanelStoryHelpers";

const BASE_SPAN: SpanHeaderData = {
  code: "OK",
  costSummary: { total: { cost: 0.0142 } },
  id: "U3BhbjpzcGFuLW5vZGUtc3Rvcnlib29r",
  latencyMs: 1842,
  name: "chat",
  spanId: "7f51c3bce0c64a11",
  spanKind: "llm",
  startTime: "2026-07-23T16:00:00.000Z",
  tokenCountTotal: 1847,
};

const GENERAL_SPANS: SpanHeaderData[] = [
  BASE_SPAN,
  {
    ...BASE_SPAN,
    id: "U3BhbjpzcGFuLW5vZGUtbG9uZy1uYW1l",
    name: `chat.completions.${"streaming".repeat(32)}`,
    spanId: "9a63f1d2e4b5780c",
  },
  {
    ...BASE_SPAN,
    id: "U3BhbjpzcGFuLW5vZGUtdW5pY29kZQ==",
    name: "会話生成 • résumé • مرحبًا • नमस्ते • 🤖",
    spanId: "c4e89a1072bd5f36",
  },
  {
    ...BASE_SPAN,
    code: "ERROR",
    id: "U3BhbjpzcGFuLW5vZGUtZW1iZWRkaW5n",
    name: "embed documents",
    spanId: "e61d97a3c5084fb2",
    spanKind: "embedding",
  },
  {
    ...BASE_SPAN,
    code: "UNSET",
    id: "U3BhbjpzcGFuLW5vZGUtdW5rbm93bg==",
    name: "unclassified operation",
    spanId: "13b7d9e5a2604cf8",
    spanKind: "unknown",
  },
];

const IDENTIFIER_PERMUTATIONS = [
  { name: "missing", spanId: "" },
  { name: "reasonable", spanId: "7f51c3bce0c64a11" },
  { name: "unreasonably lengthy", spanId: "f".repeat(256) },
] as const;

const LATENCY_PERMUTATIONS = [
  { name: "missing", latencyMs: null },
  { name: "reasonable", latencyMs: 1842 },
  { name: "unreasonably lengthy", latencyMs: 31_536_000_000 },
] as const;

const TOKEN_PERMUTATIONS = [
  { name: "missing", tokenCountTotal: null },
  { name: "reasonable", tokenCountTotal: 1847 },
  {
    name: "unreasonably lengthy",
    tokenCountTotal: Number.MAX_SAFE_INTEGER,
  },
] as const;

const COST_PERMUTATIONS = [
  { name: "missing", costSummary: null },
  { name: "reasonable", costSummary: { total: { cost: 0.0142 } } },
  {
    name: "unreasonably lengthy",
    costSummary: { total: { cost: 987_654_321.123_456 } },
  },
] as const satisfies ReadonlyArray<{
  name: string;
  costSummary: SpanHeaderData["costSummary"];
}>;

function SpanHeaderActions({
  spanKind,
  spanNodeId,
}: {
  spanKind: SpanKind;
  spanNodeId: string;
}) {
  const isPlaygroundDisabled = spanKind !== "llm";
  return (
    <>
      <LinkButton
        variant={isPlaygroundDisabled ? "default" : "primary"}
        leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
        isDisabled={isPlaygroundDisabled}
        to={`/playground/spans/${spanNodeId}`}
        size="S"
        aria-label="Prompt Playground"
      >
        Playground
      </LinkButton>
      <Button
        variant="default"
        size="S"
        leadingVisual={<Icon svg={<Icons.Database />} />}
      >
        Add to Dataset
      </Button>
      <ToggleButton
        size="S"
        isSelected={false}
        leadingVisual={<Icon svg={<Icons.Edit2 />} />}
        trailingVisual={<Keyboard>{EDIT_ANNOTATION_HOTKEY}</Keyboard>}
      >
        Annotate
      </ToggleButton>
    </>
  );
}

function SpanHeaderStoryFrame({
  span,
  hasActions = false,
}: {
  span: SpanHeaderData;
  hasActions?: boolean;
}) {
  return (
    <View padding="size-200" borderWidth="thin" borderColor="default">
      <SpanHeaderContent
        span={span}
        actions={
          hasActions ? (
            <SpanHeaderActions spanKind={span.spanKind} spanNodeId={span.id} />
          ) : undefined
        }
      />
    </View>
  );
}

const meta = {
  title: "Detail panel/Span header",
  component: SpanHeaderContent,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanHeaderContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const General: Story = {
  args: { span: BASE_SPAN },
  render: () => (
    <DetailPanelExamples>
      {GENERAL_SPANS.map((span) => (
        <SpanHeaderStoryFrame key={span.id} span={span} hasActions />
      ))}
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};

export const Metadata: Story = {
  args: { span: BASE_SPAN },
  render: () => (
    <DetailPanelExamples>
      {IDENTIFIER_PERMUTATIONS.flatMap((identifierPermutation) =>
        LATENCY_PERMUTATIONS.flatMap((latencyPermutation) =>
          TOKEN_PERMUTATIONS.flatMap((tokenPermutation) =>
            COST_PERMUTATIONS.map((costPermutation) => {
              const permutationName = [
                identifierPermutation.name,
                latencyPermutation.name,
                tokenPermutation.name,
                costPermutation.name,
              ].join("-");
              return (
                <SpanHeaderStoryFrame
                  key={permutationName}
                  span={{
                    ...BASE_SPAN,
                    id: `span-node-${permutationName}`,
                    name: "metadata stress test",
                    spanId: identifierPermutation.spanId,
                    latencyMs: latencyPermutation.latencyMs,
                    tokenCountTotal: tokenPermutation.tokenCountTotal,
                    costSummary: costPermutation.costSummary,
                  }}
                />
              );
            })
          )
        )
      )}
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
