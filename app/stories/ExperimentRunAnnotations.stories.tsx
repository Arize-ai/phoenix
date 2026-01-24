import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunAnnotations } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExperimentCompareDetailsProvider } from "@phoenix/contexts/ExperimentCompareContext";

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

type StoryArgs = {
  experimentRun: ExperimentRun;
  annotationSummaries?: AnnotationSummaries;
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
          name: "qa_correctness",
          label: "correct",
          score: 0.95,
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
          name: "has_results",
          label: null,
          score: 1.0,
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
          name: "sql_syntax_valid",
          label: "valid",
          score: 1.0,
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
  title: "Experiment/ExperimentRunAnnotations",
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

const Template: Story = (args) => {
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
        experimentRun: args.experimentRun,
      },
    ],
  };

  const annotationSummaries =
    args.annotationSummaries || mockAnnotationSummaries;

  return (
    <View
      width="600px"
      borderColor="light"
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
        annotationConfigs={[]}
        includeRepetitions={false}
        openTraceDialog={() => {}}
        referenceOutput=""
      >
        <ExperimentRunAnnotations experimentRun={args.experimentRun} />
      </ExperimentCompareDetailsProvider>
    </View>
  );
};

/**
 * Default annotation stack with multiple annotations including scores and labels
 */
export const Default = Template.bind({});
Default.args = {
  experimentRun: mockExperimentRunWithAnnotations,
};

/**
 * Annotation stack with no annotations - shows empty state
 */
export const NoAnnotations = Template.bind({});
NoAnnotations.args = {
  experimentRun: mockExperimentRunNoAnnotations,
};

/**
 * Annotation stack with only score-based annotations
 */
export const ScoreOnly = Template.bind({});
ScoreOnly.args = {
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
};

/**
 * Annotation stack with only label-based annotations
 */
export const LabelsOnly = Template.bind({});
LabelsOnly.args = {
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
};

/**
 * Annotation stack with mixed annotation types and missing annotations
 */
export const MixedWithMissing = Template.bind({});
MixedWithMissing.args = {
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
};

/**
 * Annotation stack with very long annotation names that need truncation
 */
export const LongAnnotationNames = Template.bind({});
LongAnnotationNames.args = {
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
};

/**
 * Annotation stack with very long annotation values that need truncation
 */
export const LongAnnotationValues = Template.bind({});
LongAnnotationValues.args = {
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
};

/**
 * Annotation stack with no trace links - shows annotations without trace buttons
 */
export const NoTraces = Template.bind({});
NoTraces.args = {
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
};
