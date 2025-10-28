import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentItem } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExperimentCompareDetailsProvider } from "@phoenix/contexts/ExperimentCompareContext";

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

const mockExperiment: Experiment = {
  id: "exp-1",
  name: "GPT-4 SQL Generator",
  repetitions: 1,
};

const mockExperimentWithRepetitions: Experiment = {
  id: "exp-2",
  name: "Claude-3 Sonnet Multi-Run",
  repetitions: 3,
};

const mockLongNameExperiment: Experiment = {
  id: "exp-3",
  name: "Very Long Experiment Name That Should Be Truncated Properly in the UI",
  repetitions: 1,
};

type ExperimentRepetition = {
  experimentId: string;
  repetitionNumber: number;
  experimentRun?: ExperimentRun;
};

const mockExperimentRepetition: ExperimentRepetition = {
  experimentId: "exp-1",
  repetitionNumber: 1,
  experimentRun: {
    id: "run-1",
    repetitionNumber: 1,
    latencyMs: 1500,
    experimentId: "exp-1",
    error: null,
    trace: {
      traceId: "trace-123",
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
  },
};

const mockErrorExperimentRepetition: ExperimentRepetition = {
  experimentId: "exp-2",
  repetitionNumber: 1,
  experimentRun: {
    id: "run-2",
    repetitionNumber: 1,
    latencyMs: 800,
    experimentId: "exp-2",
    output: null,
    error: "Connection timeout: Unable to connect to database after 30 seconds",
    trace: {
      traceId: "trace-error-789",
      projectId: "project-456",
    },
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
};

const mockRepetitionExperimentRepetition: ExperimentRepetition = {
  experimentId: "exp-2",
  repetitionNumber: 2,
  experimentRun: {
    id: "run-3",
    repetitionNumber: 2,
    latencyMs: 1200,
    experimentId: "exp-2",
    error: null,
    trace: {
      traceId: "trace-rep-101",
      projectId: "project-789",
    },
    output: {
      query:
        "SELECT * FROM movies WHERE genre = 'Action' ORDER BY rating DESC LIMIT 10;",
      results: [],
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
            id: "ann-4",
            name: "qa_correctness",
            label: null,
            score: 0.75,
            metadata: null,
            trace: {
              traceId: "eval-trace-444",
              projectId: "project-789",
            },
          },
        },
      ],
    },
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

const meta: Meta<typeof ExperimentItem> = {
  title: "Experiment/ExperimentItem",
  component: ExperimentItem,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A card component that displays a single experiment's results and metadata:
- **Experiment Header**: Shows experiment name with color-coded indicator
- **Run Metadata**: Displays latency, token count, and cost information
- **Annotations Stack**: Interactive grid of evaluation scores and labels
- **Output Display**: JSON output with copy-to-clipboard functionality
- **Error Handling**: Shows error messages when runs fail
- **Repetitions Support**: Displays repetition numbers when applicable
- **No Run State**: Shows empty state when experiment hasn't been run

This component is the main building block for comparing experiment results side-by-side.
        `,
      },
    },
  },
  argTypes: {
    experiment: {
      control: false,
      description: "The experiment metadata",
    },
    experimentRepetition: {
      control: false,
      description:
        "Optional experiment repetition data - if not provided, shows 'No Runs' state",
    },
    experimentIndex: {
      control: { type: "number", min: 0, max: 10 },
      description: "Index for color coding (0 = base experiment color)",
    },
  },
};

export default meta;
type Story = StoryFn<typeof ExperimentItem>;

const Template: Story = (args) => {
  const mockExperimentsById = {
    [args.experiment.id]: args.experiment,
  };

  const mockExperimentRepetitionsByExperimentId = {
    [args.experiment.id]: [args.experimentRepetition],
  };

  const includeRepetitions = args.experiment.repetitions > 1;

  const hasAnnotations =
    args.experimentRepetition.experimentRun?.annotations.edges.length ?? 0 > 0;
  const annotationSummaries = hasAnnotations ? mockAnnotationSummaries : [];

  return (
    <View
      height="600px"
      borderColor="light"
      borderWidth="thin"
      borderRadius="medium"
      overflow="hidden"
    >
      <ExperimentCompareDetailsProvider
        baseExperimentId={args.experiment.id}
        compareExperimentIds={[]}
        experimentsById={mockExperimentsById}
        experimentRepetitionsByExperimentId={
          mockExperimentRepetitionsByExperimentId
        }
        annotationSummaries={annotationSummaries}
        includeRepetitions={includeRepetitions}
        openTraceDialog={() => {}}
        referenceOutput=""
      >
        <ExperimentItem
          experiment={args.experiment}
          experimentRepetition={args.experimentRepetition}
          experimentIndex={args.experimentIndex}
        />
      </ExperimentCompareDetailsProvider>
    </View>
  );
};

/**
 * Successful experiment run with annotations and output
 */
export const WithSuccessfulRun = Template.bind({});
WithSuccessfulRun.args = {
  experiment: mockExperiment,
  experimentRepetition: mockExperimentRepetition,
  experimentIndex: 0,
};

/**
 * Experiment with no run data - shows empty state
 */
export const NoRun = Template.bind({});
NoRun.args = {
  experiment: mockExperiment,
  experimentRepetition: {
    experimentId: "exp-1",
    repetitionNumber: 1,
  },
  experimentIndex: 0,
};

/**
 * Experiment run that resulted in an error
 */
export const WithError = Template.bind({});
WithError.args = {
  experiment: mockExperiment,
  experimentRepetition: mockErrorExperimentRepetition,
  experimentIndex: 1,
};

/**
 * Experiment run with repetition number displayed
 */
export const WithRepetitions = Template.bind({});
WithRepetitions.args = {
  experiment: mockExperimentWithRepetitions,
  experimentRepetition: mockRepetitionExperimentRepetition,
  experimentIndex: 2,
};

/**
 * Experiment with long name that gets truncated
 */
export const LongName = Template.bind({});
LongName.args = {
  experiment: mockLongNameExperiment,
  experimentRepetition: mockExperimentRepetition,
  experimentIndex: 3,
};

/**
 * Experiment run with no annotations
 */
export const NoAnnotations = Template.bind({});
NoAnnotations.args = {
  experiment: mockExperiment,
  experimentRepetition: {
    experimentId: "exp-1",
    repetitionNumber: 1,
    experimentRun: {
      ...mockExperimentRepetition.experimentRun!,
      annotations: {
        edges: [],
      },
    },
  },
  experimentIndex: 0,
};

/**
 * Experiment run with no trace data
 */
export const NoTrace = Template.bind({});
NoTrace.args = {
  experiment: mockExperiment,
  experimentRepetition: {
    experimentId: "exp-1",
    repetitionNumber: 1,
    experimentRun: {
      ...mockExperimentRepetition.experimentRun!,
      trace: null,
      annotations: {
        edges: mockExperimentRepetition.experimentRun!.annotations.edges.map(
          (edge) => ({
            annotation: {
              ...edge.annotation,
              trace: null,
            },
          })
        ),
      },
    },
  },
  experimentIndex: 0,
};
