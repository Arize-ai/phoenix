import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentAnnotationStack } from "@phoenix/components/experiment/ExperimentCompareDetails";

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
        },
      },
      {
        annotation: {
          id: "ann-2",
          name: "has_results",
          label: null,
          score: 1.0,
        },
      },
      {
        annotation: {
          id: "ann-3",
          name: "sql_syntax_valid",
          label: "valid",
          score: 1.0,
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

const meta: Meta<typeof ExperimentAnnotationStack> = {
  title: "Experiment/ExperimentAnnotationStack",
  component: ExperimentAnnotationStack,
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
type Story = StoryFn<typeof ExperimentAnnotationStack>;

const Template: Story = (args) => (
  <View
    width="600px"
    borderColor="light"
    borderWidth="thin"
    borderRadius="medium"
    overflow="hidden"
  >
    <ExperimentAnnotationStack {...args} />
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
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "precision",
            label: null,
            score: 0.92,
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
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "category",
            label: "technical",
            score: null,
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
          },
        },
        // Missing "has_results" annotation
        {
          annotation: {
            id: "ann-3",
            name: "readability",
            label: "good",
            score: null,
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
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "another_extremely_long_annotation_name_for_testing_truncation_behavior",
            label: null,
            score: 0.92,
          },
        },
        {
          annotation: {
            id: "ann-3",
            name: "short_name",
            label: "good",
            score: 0.78,
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
          },
        },
        {
          annotation: {
            id: "ann-2",
            name: "error_message",
            label:
              "A very long error message that describes exactly what went wrong during the execution of this particular experiment run including stack traces and detailed debugging information",
            score: null,
          },
        },
        {
          annotation: {
            id: "ann-3",
            name: "accuracy",
            label: null,
            score: 0.95,
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
