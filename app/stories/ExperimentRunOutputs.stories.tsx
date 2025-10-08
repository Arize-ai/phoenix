import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunOutputs } from "@phoenix/components/experiment/ExperimentCompareDetails";

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

const mockExperiments: Record<string, Experiment> = {
  "exp-1": {
    id: "exp-1",
    name: "GPT-4 SQL Generator",
    repetitions: 1,
  },
  "exp-2": {
    id: "exp-2",
    name: "Claude-3 Sonnet",
    repetitions: 1,
  },
  "exp-3": {
    id: "exp-3",
    name: "GPT-3.5 Turbo",
    repetitions: 3,
  },
  "exp-4": {
    id: "exp-4",
    name: "Gemini Pro",
    repetitions: 1,
  },
};

const mockExperimentRuns: Record<string, ExperimentRun[]> = {
  "exp-1": [
    {
      id: "run-1",
      repetitionNumber: 1,
      latencyMs: 1500,
      experimentId: "exp-1",
      error: null,
      trace: {
        traceId: "trace-exp1-run1",
        projectId: "project-456",
      },
      output: {
        query:
          "SELECT title, MAX(vote_average) AS highest_rating FROM movies WHERE credits LIKE '%Brad Pitt%' GROUP BY title ORDER BY highest_rating DESC LIMIT 1;",
        results: [{ title: "Fight Club", highest_rating: 8.8 }],
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
                traceId: "eval-trace-exp1-1",
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
                traceId: "eval-trace-exp1-2",
                projectId: "project-456",
              },
            },
          },
        ],
      },
    },
  ],
  "exp-2": [
    {
      id: "run-2",
      repetitionNumber: 1,
      latencyMs: 1200,
      experimentId: "exp-2",
      error: null,
      trace: {
        traceId: "trace-exp2-run1",
        projectId: "project-789",
      },
      output: {
        query:
          "SELECT title, revenue FROM movies WHERE production_companies LIKE '%Marvel%' ORDER BY revenue DESC LIMIT 1;",
        results: [{ title: "Avengers: Endgame", revenue: 2799439100.0 }],
      },
      costSummary: {
        total: {
          cost: 0.0089,
          tokens: 198,
        },
      },
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-3",
              name: "qa_correctness",
              label: null,
              score: 0.87,
              trace: {
                traceId: "eval-trace-exp2-1",
                projectId: "project-789",
              },
            },
          },
          {
            annotation: {
              id: "ann-4",
              name: "has_results",
              label: null,
              score: 1.0,
              trace: {
                traceId: "eval-trace-exp2-2",
                projectId: "project-789",
              },
            },
          },
        ],
      },
    },
  ],
  "exp-3": [
    {
      id: "run-3",
      repetitionNumber: 1,
      latencyMs: 800,
      experimentId: "exp-3",
      error: null,
      trace: {
        traceId: "trace-exp3-run1",
        projectId: "project-123",
      },
      output: {
        query:
          "SELECT * FROM movies WHERE genre = 'Action' ORDER BY rating DESC LIMIT 10;",
        results: [],
      },
      costSummary: {
        total: {
          cost: 0.0047,
          tokens: 156,
        },
      },
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-5",
              name: "qa_correctness",
              label: null,
              score: 0.65,
              trace: {
                traceId: "eval-trace-exp3-1",
                projectId: "project-123",
              },
            },
          },
          {
            annotation: {
              id: "ann-6",
              name: "has_results",
              label: null,
              score: 0.0,
              trace: {
                traceId: "eval-trace-exp3-2",
                projectId: "project-123",
              },
            },
          },
        ],
      },
    },
    {
      id: "run-4",
      repetitionNumber: 2,
      latencyMs: 950,
      experimentId: "exp-3",
      error: null,
      trace: {
        traceId: "trace-exp3-run2",
        projectId: "project-123",
      },
      output: {
        query:
          "SELECT title FROM movies WHERE genre LIKE '%Action%' ORDER BY vote_average DESC LIMIT 10;",
        results: [{ title: "The Dark Knight" }, { title: "Inception" }],
      },
      costSummary: {
        total: {
          cost: 0.0052,
          tokens: 167,
        },
      },
      annotations: {
        edges: [
          {
            annotation: {
              id: "ann-7",
              name: "qa_correctness",
              label: null,
              score: 0.78,
              trace: {
                traceId: "eval-trace-exp3-3",
                projectId: "project-123",
              },
            },
          },
          {
            annotation: {
              id: "ann-8",
              name: "has_results",
              label: null,
              score: 1.0,
              trace: {
                traceId: "eval-trace-exp3-4",
                projectId: "project-123",
              },
            },
          },
        ],
      },
    },
    {
      id: "run-5",
      repetitionNumber: 3,
      latencyMs: 1100,
      experimentId: "exp-3",
      error: "Rate limit exceeded. Please try again later.",
      trace: {
        traceId: "trace-exp3-run3-error",
        projectId: "project-123",
      },
      output: null,
      costSummary: {
        total: {
          cost: null,
          tokens: null,
        },
      },
      annotations: {
        edges: [],
      },
    },
  ],
  "exp-4": [], // No runs for this experiment
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
];

const meta: Meta<typeof ExperimentRunOutputs> = {
  title: "Experiment/ExperimentRunOutputs",
  component: ExperimentRunOutputs,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
A comprehensive component for displaying and comparing experiment run outputs:
- **Collapsible Sidebar**: Shows experiment selection with checkboxes and repetition controls
- **Horizontal Scrolling**: Displays experiment items side-by-side in a scrollable container
- **Selection Management**: Interactive checkboxes to show/hide experiments and repetitions
- **Color Coding**: Base experiment vs comparison experiments with distinct colors
- **Repetition Support**: Handles experiments with multiple runs and repetition numbers
- **Empty States**: Shows appropriate messages for unselected or missing runs
- **Responsive Layout**: Sidebar can be collapsed and expanded with toggle button

This is the main comparison view for analyzing experiment results across multiple models or configurations.
        `,
      },
    },
  },
  argTypes: {
    baseExperimentId: {
      control: { type: "select" },
      options: Object.keys(mockExperiments),
      description: "The base experiment ID (shown with base color)",
    },
    compareExperimentIds: {
      control: false,
      description: "Array of experiment IDs to compare against the base",
    },
    experimentsById: {
      control: false,
      description: "Map of experiment IDs to experiment objects",
    },
    experimentRunsByExperimentId: {
      control: false,
      description: "Map of experiment IDs to their runs",
    },
    annotationSummaries: {
      control: false,
      description: "Summary statistics for annotations",
    },
  },
};

export default meta;
type Story = StoryFn<typeof ExperimentRunOutputs>;

const Template: Story = (args) => (
  <View borderColor="light" borderWidth="thin">
    <ExperimentRunOutputs {...args} openTraceDialog={() => {}} />
  </View>
);

/**
 * Default comparison with multiple experiments including successful runs
 */
export const Default = Template.bind({});
Default.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-3"],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Comparison including an experiment with no runs
 */
export const WithNoRunExperiment = Template.bind({});
WithNoRunExperiment.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-4"],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Comparison with experiments that have multiple repetitions
 */
export const WithRepetitions = Template.bind({});
WithRepetitions.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-3"],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Single experiment comparison (base only)
 */
export const SingleExperiment = Template.bind({});
SingleExperiment.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: [],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Comparison with experiments containing errors
 */
export const WithErrors = Template.bind({});
WithErrors.args = {
  baseExperimentId: "exp-2",
  compareExperimentIds: ["exp-3"],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};

/**
 * Large comparison with many experiments
 */
export const ManyExperiments = Template.bind({});
ManyExperiments.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-3", "exp-4"],
  experimentsById: mockExperiments,
  experimentRunsByExperimentId: mockExperimentRuns,
  annotationSummaries: mockAnnotationSummaries,
};
