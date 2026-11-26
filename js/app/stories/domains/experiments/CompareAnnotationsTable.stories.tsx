import type { Meta, StoryObj } from "@storybook/react";

import type { AnnotationConfig } from "@phoenix/components/annotation";
import {
  buildLaneAnnotationRow,
  computeAnnotationRowDelta,
} from "@phoenix/pages/experiment/compareSlideover/experimentCompareAnnotationRows";
import type { ExperimentCompareAnnotationsTableRow } from "@phoenix/pages/experiment/compareSlideover/ExperimentCompareAnnotationsTable";
import { ExperimentCompareAnnotationsTable } from "@phoenix/pages/experiment/compareSlideover/ExperimentCompareAnnotationsTable";
import type {
  CompareLaneAnnotation,
  CompareLaneRun,
} from "@phoenix/pages/experiment/compareSlideover/useExperimentCompareLaneRunGroup";

import { experimentAnnotationConfigs } from "../../constants/experimentEvaluatorFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

const ANNOTATION_NAMES = [
  "answer_relevance",
  "column_coverage",
  "verbosity",
  "tone",
];

const configsByName: Partial<Record<string, AnnotationConfig>> =
  Object.fromEntries(
    experimentAnnotationConfigs.map((config) => [config.name, config])
  );

function buildAnnotation({
  name,
  score = null,
  label = null,
}: {
  name: string;
  score?: number | null;
  label?: string | null;
}): CompareLaneAnnotation {
  return {
    id: `${name}-${score}-${label}`,
    name,
    score,
    label,
    annotatorKind: "CODE",
    explanation: null,
    metadata: {},
    trace: { traceId: `eval-trace-${name}`, projectId: "project-1" },
  };
}

function buildRun({
  repetitionNumber,
  scores,
  tone,
}: {
  repetitionNumber: number;
  /** answer_relevance, column_coverage and verbosity, in that order */
  scores: readonly [number, number, number];
  tone?: string;
}): CompareLaneRun {
  return {
    id: `run-${repetitionNumber}`,
    repetitionNumber,
    latencyMs: 1500,
    output: {},
    error: null,
    trace: null,
    costSummary: { total: { tokens: 342, cost: 0.02 } },
    annotations: [
      buildAnnotation({ name: "answer_relevance", score: scores[0] }),
      buildAnnotation({ name: "column_coverage", score: scores[1] }),
      buildAnnotation({ name: "verbosity", score: scores[2] }),
      ...(tone != null ? [buildAnnotation({ name: "tone", label: tone })] : []),
    ],
  };
}

const BASE_RUNS = [
  buildRun({ repetitionNumber: 1, scores: [0.9, 0.5, 0.8], tone: "neutral" }),
  buildRun({ repetitionNumber: 2, scores: [0.7, 1, 0.6], tone: "neutral" }),
  buildRun({ repetitionNumber: 3, scores: [0.4, 0, 0.9], tone: "terse" }),
];

const COMPARE_RUNS = [
  buildRun({ repetitionNumber: 1, scores: [0.95, 1, 0.4], tone: "formal" }),
  buildRun({ repetitionNumber: 2, scores: [0.6, 1, 0.5], tone: "formal" }),
  buildRun({ repetitionNumber: 3, scores: [0.8, 0.5, 0.3] }),
];

const TONES = ["neutral", "formal", "terse"];

const MANY_REPETITION_RUNS = Array.from({ length: 12 }, (_unused, index) =>
  buildRun({
    repetitionNumber: index + 1,
    scores: [(index % 5) / 4, index % 2, ((index * 3) % 7) / 6],
    tone: TONES[index % 3],
  })
);

function buildRows({
  runs,
  baseRuns,
  shownRepetitionNumber = 1,
}: {
  runs: readonly CompareLaneRun[];
  /** The base lane's runs; omitted on the base lane itself */
  baseRuns?: readonly CompareLaneRun[];
  shownRepetitionNumber?: number;
}): ExperimentCompareAnnotationsTableRow[] {
  return ANNOTATION_NAMES.map((annotationName) => {
    const config = configsByName[annotationName];
    const row = buildLaneAnnotationRow({
      annotationName,
      runs,
      shownRepetitionNumber,
    });
    if (baseRuns == null) {
      return { row, config, delta: null };
    }
    const baseRow = buildLaneAnnotationRow({
      annotationName,
      runs: baseRuns,
      shownRepetitionNumber,
    });
    return {
      row,
      config,
      delta: computeAnnotationRowDelta({
        baseAnnotation: baseRow.annotation,
        compareAnnotation: row.annotation,
        config,
      }),
      baseValueText: baseRow.valueText,
    };
  });
}

const meta: Meta<typeof ExperimentCompareAnnotationsTable> = {
  title: "Domains/Experiments/Compare Annotations Table",
  component: ExperimentCompareAnnotationsTable,
  tags: ["updated", "complete", "unreviewed"],
  args: { onOpenAnnotationTrace: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 560, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ExperimentCompareAnnotationsTable>;

export const Default: Story = {
  tags: ["!dev"],
  args: {
    rows: buildRows({ runs: COMPARE_RUNS, baseRuns: BASE_RUNS }),
    hasRepetitions: true,
    showsDeltas: true,
  },
};

const LANES = [
  { id: "base", label: "Base lane" },
  { id: "compare", label: "Compare lane" },
] as const;

const REPETITIONS = [
  { id: "single", label: "One repetition" },
  { id: "three", label: "Three repetitions" },
  { id: "twelve", label: "Twelve repetitions, capped at 8" },
] as const;

export const Lanes: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: (args) => (
    <OptionGrid
      rows={REPETITIONS}
      columns={LANES}
      justifyCells="stretch"
      cellWidth="520px"
      renderCell={(row, column) => {
        const isCompareLane = column?.id === "compare";
        const runsByRepetitions = {
          single: COMPARE_RUNS.slice(0, 1),
          three: COMPARE_RUNS,
          twelve: MANY_REPETITION_RUNS,
        };
        return (
          <ExperimentCompareAnnotationsTable
            {...args}
            rows={buildRows({
              runs: isCompareLane ? runsByRepetitions[row.id] : BASE_RUNS,
              baseRuns: isCompareLane ? BASE_RUNS : undefined,
              shownRepetitionNumber: row.id === "single" ? 1 : 2,
            })}
            hasRepetitions={row.id !== "single"}
            showsDeltas={isCompareLane}
          />
        );
      }}
    />
  ),
};
