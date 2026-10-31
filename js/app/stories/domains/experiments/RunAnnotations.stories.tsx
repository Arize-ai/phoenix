import type { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import type { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunAnnotations } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExperimentCompareDetailsProvider } from "@phoenix/contexts/ExperimentCompareContext";

import { experimentAnnotationConfigs } from "../../constants/experimentEvaluatorFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

type RunAnnotation = NonNullable<
  ExperimentRun["annotations"]
>["edges"][number]["annotation"];

type StoryArgs = {
  experimentRun: ExperimentRun;
  annotationSummaries?: AnnotationSummaries;
  /** The container's width. Defaults to 600px. */
  width?: string;
};

const mockExperimentRunWithAnnotations: ExperimentRun = {
  id: "run-1",
  repetitionNumber: 1,
  latencyMs: 1500,
  experimentId: "exp-1",
  output: { result: "Generated SQL query", success: true },
  error: null,
  trace: {
    traceId: "trace-123",
    projectId: "project-456",
  },
  costSummary: {
    total: {
      cost: 0.0205,
      tokens: 342,
    },
  },
  annotations: {
    edges: [
      {
        annotation: {
          id: "ann-1",
          name: "answer_relevance",
          label: null,
          score: 0.92,
          metadata: null,
          trace: {
            traceId: "eval-trace-111",
            projectId: "project-456",
          },
        },
      },
      {
        annotation: {
          id: "ann-2",
          name: "column_coverage",
          label: null,
          score: 0.5,
          metadata: null,
          trace: {
            traceId: "eval-trace-222",
            projectId: "project-456",
          },
        },
      },
      {
        annotation: {
          id: "ann-3",
          name: "verbosity",
          label: null,
          score: 0.81,
          metadata: null,
          trace: {
            traceId: "eval-trace-333",
            projectId: "project-456",
          },
        },
      },
    ],
  },
};

const mockExperimentRunNoAnnotations: ExperimentRun = {
  id: "run-2",
  repetitionNumber: 1,
  latencyMs: 800,
  experimentId: "exp-2",
  output: { result: "No annotations available" },
  error: null,
  trace: {
    traceId: "trace-456",
    projectId: "project-789",
  },
  costSummary: {
    total: {
      cost: 0.0089,
      tokens: 198,
    },
  },
  annotations: {
    edges: [],
  },
};

const mockAnnotationSummaries: AnnotationSummaries = [
  {
    annotationName: "qa_correctness",
    minScore: 0.0,
    maxScore: 1.0,
  },
  {
    annotationName: "has_results",
    minScore: 0.0,
    maxScore: 1.0,
  },
  {
    annotationName: "sql_syntax_valid",
    minScore: 0.0,
    maxScore: 1.0,
  },
];

const meta: Meta<StoryArgs> = {
  title: "Domains/Experiments/Run Annotations",
  tags: ["updated", "incomplete", "unreviewed"],
  component: ExperimentRunAnnotations,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A stack component that displays experiment annotations in a grid layout:
- **Grid Layout**: Uses CSS Grid with three columns for name, value, and progress bar
- **Interactive Items**: Each annotation is clickable and shows details in a popover
- **Score Visualization**: Shows progress bars for numeric scores with percentile calculation
- **Flexible Content**: Handles both score-based and label-based annotations
- **Empty States**: Gracefully handles missing annotations with placeholder spacing

This component is used within ExperimentItem to display evaluation results and metrics.
        `,
      },
    },
  },
  argTypes: {
    experimentRun: {
      control: false,
      description: "The experiment run containing annotation data",
    },
    annotationSummaries: {
      control: false,
      description:
        "Optional custom annotation summaries. If not provided, uses mockAnnotationSummaries",
    },
  },
};

export default meta;
type Story = StoryFn<StoryArgs>;

function RunAnnotationsFrame({
  experimentRun,
  annotationSummaries = mockAnnotationSummaries,
  width = "600px",
}: StoryArgs) {
  const mockExperimentsById = {
    "exp-1": {
      id: "exp-1",
      name: "Mock Experiment",
      repetitions: 1,
    },
  };

  const mockExperimentRepetitionsByExperimentId = {
    "exp-1": [
      {
        experimentId: "exp-1",
        repetitionNumber: 1,
        experimentRun,
      },
    ],
  };

  return (
    <View
      width={width}
      borderColor="default"
      borderWidth="thin"
      borderRadius="medium"
      overflow="hidden"
    >
      <ExperimentCompareDetailsProvider
        baseExperimentId="exp-1"
        compareExperimentIds={[]}
        experimentsById={mockExperimentsById}
        experimentRepetitionsByExperimentId={
          mockExperimentRepetitionsByExperimentId
        }
        annotationSummaries={annotationSummaries}
        annotationConfigs={experimentAnnotationConfigs}
        includeRepetitions={false}
        openTraceDialog={() => {}}
        referenceOutput=""
      >
        <ExperimentRunAnnotations experimentRun={experimentRun} />
      </ExperimentCompareDetailsProvider>
    </View>
  );
}

const Template: Story = (args) => <RunAnnotationsFrame {...args} />;

export const Default = {
  render: Template,

  args: {
    experimentRun: mockExperimentRunWithAnnotations,
    annotationSummaries: [
      { annotationName: "answer_relevance", minScore: 0.0, maxScore: 1.0 },
      { annotationName: "column_coverage", minScore: 0.0, maxScore: 1.0 },
      { annotationName: "verbosity", minScore: 0.0, maxScore: 1.0 },
    ],
  },
};

const SCORE_CASES: readonly {
  label: string;
  name: string;
  score: number;
  annotationLabel: string | null;
}[] = [
  {
    label: "Maximize, near the best bound",
    name: "qa_correctness",
    score: 0.9,
    annotationLabel: null,
  },
  {
    label: "Maximize, above the pivot",
    name: "qa_correctness",
    score: 0.62,
    annotationLabel: null,
  },
  {
    label: "Maximize, at the pivot",
    name: "qa_correctness",
    score: 0.5,
    annotationLabel: null,
  },
  {
    label: "Maximize, below the pivot",
    name: "qa_correctness",
    score: 0.31,
    annotationLabel: null,
  },
  {
    label: "Maximize, past the upper bound",
    name: "qa_correctness",
    score: 1.3,
    annotationLabel: null,
  },
  {
    label: "Minimize, low",
    name: "toxicity",
    score: 0.08,
    annotationLabel: null,
  },
  {
    label: "Minimize, high",
    name: "toxicity",
    score: 0.74,
    annotationLabel: null,
  },
  {
    label: "Threshold only, above",
    name: "row_overlap",
    score: 0.84,
    annotationLabel: null,
  },
  {
    label: "Threshold only, below",
    name: "row_overlap",
    score: 0.72,
    annotationLabel: null,
  },
  {
    label: "Categorical, best value",
    name: "sql_syntax_valid",
    score: 1,
    annotationLabel: "valid",
  },
  {
    label: "Categorical, worst value",
    name: "sql_syntax_valid",
    score: 0,
    annotationLabel: "invalid",
  },
  {
    label: "No direction",
    name: "query_complexity",
    score: 1,
    annotationLabel: "complex",
  },
  {
    label: "No config",
    name: "bleu",
    score: 0.42,
    annotationLabel: null,
  },
];

function scoreCaseRun({
  name,
  score,
  annotationLabel,
}: (typeof SCORE_CASES)[number]): ExperimentRun {
  const annotation: RunAnnotation = {
    id: `ann-${name}-${score}`,
    name,
    label: annotationLabel,
    score,
    metadata: null,
    trace: {
      traceId: `eval-trace-${name}-${score}`,
      projectId: "project-456",
    },
  };
  return {
    ...mockExperimentRunWithAnnotations,
    annotations: { edges: [{ annotation }] },
  };
}

/**
 * Each evaluator's score is colored by its output config. `qa_correctness`
 * is continuous and maximized over 0 to 1, so its color grades from the
 * pivot at 0.5 and clamps past the bound. `toxicity` is minimized over 0 to
 * 1. `row_overlap` is freeform with a threshold of 0.8 and no bounds, so
 * either side of the threshold takes the full color. `sql_syntax_valid` is
 * categorical, scored `valid` 1 and `invalid` 0. `query_complexity` sets no
 * direction, and `bleu` has no dataset evaluator, so neither is colored.
 */
export const ScoreColors = {
  name: "Score Colors",
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={SCORE_CASES}
      renderCell={(scoreCase) => (
        <RunAnnotationsFrame
          width="440px"
          experimentRun={scoreCaseRun(scoreCase)}
          annotationSummaries={[
            {
              annotationName: scoreCase.name,
              minScore: 0,
              maxScore: Math.max(1, scoreCase.score),
            },
          ]}
        />
      )}
    />
  ),
};

export const NoAnnotations = {
  render: Template,

  args: {
    experimentRun: mockExperimentRunNoAnnotations,
  },
};

export const ScoreOnly = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness",
              label: null,
              score: 0.87,
              metadata: null,
              trace: {
                traceId: "eval-trace-score-1",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-2",
              name: "has_results",
              label: null,
              score: 0.92,
              metadata: null,
              trace: {
                traceId: "eval-trace-score-2",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: null,
              score: 1.0,
              metadata: null,
              trace: {
                traceId: "eval-trace-score-3",
                projectId: "project-456",
              },
            },
          },
        ],
      },
    },
  },
};

export const LabelsOnly = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness",
              label: "correct",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-label-1",
                projectId: "project-789",
              },
            },
          },
          {
            annotation: {
              id: "ann-2",
              name: "has_results",
              label: "yes",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-label-2",
                projectId: "project-789",
              },
            },
          },
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: "valid",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-label-3",
                projectId: "project-789",
              },
            },
          },
        ],
      },
    },
  },
};

export const MixedWithMissing = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness",
              label: null,
              score: 0.75,
              metadata: null,
              trace: {
                traceId: "eval-trace-mixed-1",
                projectId: "project-456",
              },
            },
          },
          // Missing "has_results" annotation
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: "good",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-mixed-2",
                projectId: "project-456",
              },
            },
          },
        ],
      },
    },
  },
};

export const LongAnnotationNames = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness_with_very_long_name_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
              label: "correct",
              score: 0.85,
              metadata: null,
              trace: {
                traceId: "eval-trace-long-1",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-2",
              name: "has_results_with_another_extremely_long_annotation_name_for_testing_truncation_behavior",
              label: null,
              score: 0.92,
              metadata: null,
              trace: {
                traceId: "eval-trace-long-2",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: "good",
              score: 0.78,
              metadata: null,
              trace: {
                traceId: "eval-trace-long-3",
                projectId: "project-456",
              },
            },
          },
        ],
      },
    },
    annotationSummaries: [
      {
        annotationName:
          "qa_correctness_with_very_long_name_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
        minScore: 0.0,
        maxScore: 1.0,
      },
      {
        annotationName:
          "has_results_with_another_extremely_long_annotation_name_for_testing_truncation_behavior",
        minScore: 0.0,
        maxScore: 1.0,
      },
      {
        annotationName: "sql_syntax_valid",
        minScore: 0.0,
        maxScore: 1.0,
      },
    ],
  },
};

export const LongAnnotationValues = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness",
              label:
                "This is an extremely long annotation value that contains detailed feedback about the quality of the generated response and should be truncated properly in the UI to maintain good layout and readability",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-value-1",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-2",
              name: "has_results",
              label:
                "A very long error message that describes exactly what went wrong during the execution of this particular experiment run including stack traces and detailed debugging information",
              score: null,
              metadata: null,
              trace: {
                traceId: "eval-trace-value-2",
                projectId: "project-456",
              },
            },
          },
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: null,
              score: 0.95,
              metadata: null,
              trace: {
                traceId: "eval-trace-value-3",
                projectId: "project-456",
              },
            },
          },
        ],
      },
    },
  },
};

export const NoTraces = {
  render: Template,

  args: {
    experimentRun: {
      ...mockExperimentRunWithAnnotations,
      trace: null,
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-1",
              name: "qa_correctness",
              label: "correct",
              score: 0.95,
              metadata: null,
              trace: null,
            },
          },
          {
            annotation: {
              id: "ann-2",
              name: "has_results",
              label: null,
              score: 1.0,
              metadata: null,
              trace: null,
            },
          },
          {
            annotation: {
              id: "ann-3",
              name: "sql_syntax_valid",
              label: "valid",
              score: 1.0,
              metadata: null,
              trace: null,
            },
          },
        ],
      },
    },
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  args: { ...Default.args, width: "100%" },
  // Wide enough that the annotation names and scores are not truncated.
  parameters: { thumbnail: { scale: 0.6 } },
};
