import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunAnnotations } from "@phoenix/components/experiment/ExperimentCompareDetails";

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

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

const meta: Meta<typeof ExperimentRunAnnotations> = {
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
        "Summary statistics for annotations to calculate percentiles",
    },
  },
};

export default meta;
type Story = StoryFn<typeof ExperimentRunAnnotations>;

const Template: Story = (args) => (
  <View
    width="600px"
    borderColor="light"
    borderWidth="thin"
    borderRadius="medium"
    overflow="hidden"
  >
    <ExperimentRunAnnotations {...args} openTraceDialog={() => {}} />
  </View>
);

/**
 * Default annotation stack with multiple annotations including scores and labels
 */
export const Default = Template.bind({});
Default.args = {
  experimentRun: mockExperimentRunWithAnnotations,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Annotation stack with no annotations - shows empty state
 */
export const NoAnnotations = Template.bind({});
NoAnnotations.args = {
  experimentRun: mockExperimentRunNoAnnotations,
  annotationSummaries: mockAnnotationSummaries,
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
            name: "accuracy",
            label: null,
            score: 0.87,
            trace: {
              traceId: "eval-trace-score-1",
              projectId: "project-456",
            },
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "precision",
            label: null,
            score: 0.92,
            trace: {
              traceId: "eval-trace-score-2",
              projectId: "project-456",
            },
          },
        },
      ],
    },
  },
  annotationSummaries: [
    {
      annotationName: "accuracy",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName: "precision",
      minScore: 0.0,
      maxScore: 1.0,
    },
  ],
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
            name: "sentiment",
            label: "positive",
            score: null,
            trace: {
              traceId: "eval-trace-label-1",
              projectId: "project-789",
            },
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "category",
            label: "technical",
            score: null,
            trace: {
              traceId: "eval-trace-label-2",
              projectId: "project-789",
            },
          },
        },
      ],
    },
  },
  annotationSummaries: [
    {
      annotationName: "sentiment",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName: "category",
      minScore: 0.0,
      maxScore: 1.0,
    },
  ],
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
            name: "readability",
            label: "good",
            score: null,
            trace: {
              traceId: "eval-trace-mixed-2",
              projectId: "project-456",
            },
          },
        },
      ],
    },
  },
  annotationSummaries: [
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
      annotationName: "readability",
      minScore: 0.0,
      maxScore: 1.0,
    },
  ],
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
            name: "very_long_annotation_name_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
            label: "correct",
            score: 0.85,
            trace: {
              traceId: "eval-trace-long-1",
              projectId: "project-456",
            },
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "another_extremely_long_annotation_name_for_testing_truncation_behavior",
            label: null,
            score: 0.92,
            trace: {
              traceId: "eval-trace-long-2",
              projectId: "project-456",
            },
          },
        },
        {
          annotation: {
            id: "ann-3",
            name: "short_name",
            label: "good",
            score: 0.78,
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
        "very_long_annotation_name_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName:
        "another_extremely_long_annotation_name_for_testing_truncation_behavior",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName: "short_name",
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
            name: "detailed_feedback_label_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
            label:
              "This is an extremely long annotation value that contains detailed feedback about the quality of the generated response and should be truncated properly in the UI to maintain good layout and readability",
            score: null,
            trace: {
              traceId: "eval-trace-value-1",
              projectId: "project-456",
            },
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "error_message",
            label:
              "A very long error message that describes exactly what went wrong during the execution of this particular experiment run including stack traces and detailed debugging information",
            score: null,
            trace: {
              traceId: "eval-trace-value-2",
              projectId: "project-456",
            },
          },
        },
        {
          annotation: {
            id: "ann-3",
            name: "accuracy",
            label: null,
            score: 0.95,
            trace: {
              traceId: "eval-trace-value-3",
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
        "detailed_feedback_label_that_should_be_truncated_in_the_ui_to_prevent_layout_issues",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName: "error_message",
      minScore: 0.0,
      maxScore: 1.0,
    },
    {
      annotationName: "accuracy",
      minScore: 0.0,
      maxScore: 1.0,
    },
  ],
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
            trace: null,
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "has_results",
            label: null,
            score: 1.0,
            trace: null,
          },
        },
        {
          annotation: {
            id: "ann-3",
            name: "sql_syntax_valid",
            label: "valid",
            score: 1.0,
            trace: null,
          },
        },
      ],
    },
  },
  annotationSummaries: mockAnnotationSummaries,
};
