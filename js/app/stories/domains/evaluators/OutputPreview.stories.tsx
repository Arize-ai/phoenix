import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { userEvent, within } from "storybook/test";

import { Flex } from "@phoenix/components";
import type { EvaluatorOutputPreviewMutation } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import { makeLLMEvaluatorInstance } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { EvaluatorOutputPreview } from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { PlaygroundProvider } from "@phoenix/contexts/PlaygroundContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import { OptionGrid } from "../../utils/OptionGrid";

type PreviewResult =
  EvaluatorOutputPreviewMutation["response"]["evaluatorPreviews"]["results"][number];

function annotationResult({
  id,
  name,
  label,
  score,
}: {
  id: string;
  name: string;
  label: string;
  score: number | null;
}): PreviewResult {
  return {
    evaluatorName: name,
    annotation: {
      id,
      name,
      label,
      score,
      explanation: `The response is ${label} for the given input.`,
    },
    error: null,
  };
}

function TestedEvaluator({
  evaluatorName,
  outputConfigs,
  results,
}: {
  evaluatorName: string;
  outputConfigs: AnnotationConfig[];
  results: PreviewResult[];
}) {
  const [environment] = useState(
    () =>
      new Environment({
        network: Network.create(async () => ({
          data: { evaluatorPreviews: { results } },
        })),
        store: new Store(new RecordSource()),
      })
  );
  return (
    <RelayEnvironmentProvider environment={environment}>
      <AgentProvider>
        <CredentialsProvider>
          <PlaygroundProvider
            modelConfigByProvider={{}}
            instances={makeLLMEvaluatorInstance({ modelConfigByProvider: {} })}
          >
            <EvaluatorStoreProvider
              initialState={{
                evaluator: {
                  kind: "LLM",
                  name: evaluatorName,
                  globalName: evaluatorName,
                  description: "",
                  isBuiltin: false,
                  includeExplanation: true,
                  inputMapping: { literalMapping: {}, pathMapping: {} },
                },
                outputConfigs,
              }}
            >
              <Flex direction="column" gap="size-100">
                <EvaluatorOutputPreview />
              </Flex>
            </EvaluatorStoreProvider>
          </PlaygroundProvider>
        </CredentialsProvider>
      </AgentProvider>
    </RelayEnvironmentProvider>
  );
}

async function runEveryTest({ canvasElement }: { canvasElement: HTMLElement }) {
  const buttons = await within(canvasElement).findAllByRole("button", {
    name: "Test",
  });
  for (const button of buttons) {
    await userEvent.click(button);
  }
  await userEvent.click(canvasElement);
}

const CORRECTNESS: ClassificationEvaluatorAnnotationConfig = {
  name: "correctness",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "correct", score: 1 },
    { label: "incorrect", score: 0 },
  ],
};

const RELEVANCE: ClassificationEvaluatorAnnotationConfig = {
  name: "relevance",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "very relevant", score: 5 },
    { label: "relevant", score: 4 },
    { label: "somewhat relevant", score: 3 },
    { label: "barely relevant", score: 2 },
    { label: "irrelevant", score: 1 },
  ],
};

const HALLUCINATION: ClassificationEvaluatorAnnotationConfig = {
  name: "hallucination",
  optimizationDirection: "MINIMIZE",
  values: [
    { label: "hallucinated", score: 1 },
    { label: "factual", score: 0 },
  ],
};

const TONE: ClassificationEvaluatorAnnotationConfig = {
  name: "tone",
  optimizationDirection: "NONE",
  values: [
    { label: "formal", score: 1 },
    { label: "casual", score: 0 },
  ],
};

const TOPIC: ClassificationEvaluatorAnnotationConfig = {
  name: "topic",
  optimizationDirection: "MAXIMIZE",
  values: [{ label: "billing" }, { label: "shipping" }],
};

type LabelCase = {
  label: string;
  config: ClassificationEvaluatorAnnotationConfig;
  resultLabel: string;
};

const LABEL_CASES: readonly LabelCase[] = [
  {
    label: "Maximize, best label",
    config: CORRECTNESS,
    resultLabel: "correct",
  },
  {
    label: "Maximize, worst label",
    config: CORRECTNESS,
    resultLabel: "incorrect",
  },
  {
    label: "Five labels, second best",
    config: RELEVANCE,
    resultLabel: "relevant",
  },
  {
    label: "Five labels, middle",
    config: RELEVANCE,
    resultLabel: "somewhat relevant",
  },
  {
    label: "Five labels, second worst",
    config: RELEVANCE,
    resultLabel: "barely relevant",
  },
  { label: "Minimize", config: HALLUCINATION, resultLabel: "factual" },
  { label: "Undirected", config: TONE, resultLabel: "formal" },
  { label: "Labels without scores", config: TOPIC, resultLabel: "billing" },
];

function resultFor(config: ClassificationEvaluatorAnnotationConfig) {
  return (resultLabel: string, name = config.name) =>
    annotationResult({
      id: `${name}:${resultLabel}`,
      name,
      label: resultLabel,
      score:
        config.values.find((value) => value.label === resultLabel)?.score ??
        null,
    });
}

/**
 * The test step of the LLM evaluator dialog. Pressing Test runs the
 * evaluator's prompt against the selected example and lists each annotation
 * the judge returned. The score of the chosen label is colored by where it
 * falls between the worst- and best-scored labels of its output config:
 * neutral at the pivot between them, and more strongly green or red toward
 * either end.
 *
 * The stories press Test on load, so each opens on its result.
 */
const meta = {
  title: "Domains/Evaluators/Output Preview",
  component: EvaluatorOutputPreview,
  parameters: {
    controls: { disable: true },
    docs: { story: { autoplay: true } },
  },
  tags: ["updated", "incomplete", "unreviewed"],
  play: runEveryTest,
} satisfies Meta<typeof EvaluatorOutputPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

const CELL_WIDTH = "360px";

export const Default: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <div style={{ width: CELL_WIDTH }}>
      <TestedEvaluator
        evaluatorName="correctness"
        outputConfigs={[CORRECTNESS]}
        results={[resultFor(CORRECTNESS)("correct")]}
      />
    </div>
  ),
};

export const LabelPositions: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <OptionGrid
      rows={LABEL_CASES}
      cellWidth={CELL_WIDTH}
      justifyCells="stretch"
      renderCell={(row) => (
        <TestedEvaluator
          evaluatorName={row.config.name}
          outputConfigs={[row.config]}
          results={[resultFor(row.config)(row.resultLabel)]}
        />
      )}
    />
  ),
};

/**
 * An evaluator with several output configs returns one annotation per
 * config, named `<evaluator>.<config>`, and each is colored by its own
 * config.
 */
export const MultipleOutputs: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <div style={{ width: CELL_WIDTH }}>
      <TestedEvaluator
        evaluatorName="response_judge"
        outputConfigs={[CORRECTNESS, RELEVANCE, HALLUCINATION]}
        results={[
          resultFor(CORRECTNESS)("correct", "response_judge.correctness"),
          resultFor(RELEVANCE)("barely relevant", "response_judge.relevance"),
          resultFor(HALLUCINATION)(
            "hallucinated",
            "response_judge.hallucination"
          ),
        ]}
      />
    </div>
  ),
};
