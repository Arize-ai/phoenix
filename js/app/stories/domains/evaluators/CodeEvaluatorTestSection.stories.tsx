import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { userEvent, within } from "storybook/test";

import type { CodeEvaluatorTestSectionMutation } from "@phoenix/components/evaluators/__generated__/CodeEvaluatorTestSectionMutation.graphql";
import { CodeEvaluatorTestSection } from "@phoenix/components/evaluators/CodeEvaluatorTestSection";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import { OptionGrid } from "../../utils/OptionGrid";

type PreviewResult =
  CodeEvaluatorTestSectionMutation["response"]["evaluatorPreviews"]["results"][number];

const SOURCE_CODE = `def evaluate(output, reference):
    return {"score": float(output == reference)}`;

function annotationResult({
  id,
  name,
  score,
  label = null,
  explanation = null,
}: {
  id: string;
  name: string;
  score: number | null;
  label?: string | null;
  explanation?: string | null;
}): PreviewResult {
  return {
    evaluatorName: name,
    annotation: { id, name, score, label, explanation },
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
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "CODE",
              name: evaluatorName,
              globalName: evaluatorName,
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { literalMapping: {}, pathMapping: {} },
            },
            outputConfigs,
          }}
        >
          <CodeEvaluatorTestSection
            sourceCode={SOURCE_CODE}
            language="PYTHON"
            sandboxConfigId="U2FuZGJveENvbmZpZzox"
            isDraftMounted={() => true}
          />
        </EvaluatorStoreProvider>
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

const UNIT_INTERVAL = { lowerBound: 0, upperBound: 1 };

type ScoreCase = {
  label: string;
  config: AnnotationConfig;
  score: number;
  resultLabel?: string;
};

const SCORE_CASES: readonly ScoreCase[] = [
  {
    label: "Maximize, near the best bound",
    config: {
      name: "correctness",
      optimizationDirection: "MAXIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 0.9,
  },
  {
    label: "Maximize, above the pivot",
    config: {
      name: "correctness",
      optimizationDirection: "MAXIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 0.62,
  },
  {
    label: "Maximize, at the pivot",
    config: {
      name: "correctness",
      optimizationDirection: "MAXIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 0.5,
  },
  {
    label: "Maximize, below the pivot",
    config: {
      name: "correctness",
      optimizationDirection: "MAXIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 0.31,
  },
  {
    label: "Maximize, above the upper bound",
    config: {
      name: "correctness",
      optimizationDirection: "MAXIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 1.2,
  },
  {
    label: "Minimize",
    config: {
      name: "toxicity",
      optimizationDirection: "MINIMIZE",
      ...UNIT_INTERVAL,
    },
    score: 0.2,
  },
  {
    label: "Threshold only",
    config: {
      name: "keyword_coverage",
      optimizationDirection: "MAXIMIZE",
      threshold: 0.8,
    },
    score: 0.84,
  },
  {
    label: "Categorical",
    config: {
      name: "exact_match",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "match", score: 1 },
        { label: "no match", score: 0 },
      ],
    },
    score: 0,
    resultLabel: "no match",
  },
  {
    label: "Undirected",
    config: {
      name: "response_length",
      optimizationDirection: "NONE",
      lowerBound: 0,
      upperBound: 500,
    },
    score: 212,
  },
];

/**
 * The test section of the code evaluator dialog. Pressing Test runs the
 * evaluator against the selected example and lists each annotation it
 * returned. The annotation's score is colored by where it falls between the
 * worst and best bounds of the output config that produced it: neutral at the
 * pivot between them, and more strongly green or red toward either bound.
 *
 * The stories press Test on load, so each opens on its result.
 */
const meta = {
  title: "Domains/Evaluators/Code Evaluator Test Section",
  component: CodeEvaluatorTestSection,
  parameters: {
    controls: { disable: true },
    docs: { story: { autoplay: true } },
  },
  tags: ["updated", "incomplete", "unreviewed"],
  play: runEveryTest,
} satisfies Meta<typeof CodeEvaluatorTestSection>;

export default meta;
type Story = StoryObj;

const CELL_WIDTH = "360px";

export const Default: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <div style={{ width: CELL_WIDTH }}>
      <TestedEvaluator
        evaluatorName="correctness"
        outputConfigs={[SCORE_CASES[1].config]}
        results={[
          annotationResult({
            id: "default",
            name: "correctness",
            score: 0.62,
          }),
        ]}
      />
    </div>
  ),
};

export const ScorePositions: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <OptionGrid
      rows={SCORE_CASES}
      cellWidth={CELL_WIDTH}
      justifyCells="stretch"
      renderCell={(row) => (
        <TestedEvaluator
          evaluatorName={row.config.name}
          outputConfigs={[row.config]}
          results={[
            annotationResult({
              id: row.label,
              name: row.config.name,
              score: row.score,
              label: row.resultLabel ?? null,
            }),
          ]}
        />
      )}
    />
  ),
};

const MULTI_OUTPUT_CONFIGS: AnnotationConfig[] = [
  { name: "correctness", optimizationDirection: "MAXIMIZE", ...UNIT_INTERVAL },
  { name: "toxicity", optimizationDirection: "MINIMIZE", ...UNIT_INTERVAL },
  {
    name: "format",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "valid", score: 1 },
      { label: "invalid", score: 0 },
    ],
  },
];

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
        evaluatorName="answer_quality"
        outputConfigs={MULTI_OUTPUT_CONFIGS}
        results={[
          annotationResult({
            id: "multi-correctness",
            name: "answer_quality.correctness",
            score: 0.9,
          }),
          annotationResult({
            id: "multi-toxicity",
            name: "answer_quality.toxicity",
            score: 0.4,
          }),
          annotationResult({
            id: "multi-format",
            name: "answer_quality.format",
            score: 0,
            label: "invalid",
          }),
        ]}
      />
    </div>
  ),
};
