import { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunOutputs } from "@phoenix/components/experiment/ExperimentCompareDetails";
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

type ReferenceOutput = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["revision"]
>["referenceOutput"];

type StoryArgs = {
  baseExperimentId: string;
  compareExperimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRepetitionsByExperimentId: Record<string, ExperimentRepetition[]>;
  annotationSummaries: AnnotationSummaries;
  referenceOutput: ReferenceOutput;
};

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

type ExperimentRepetition = {
  experimentId: string;
  repetitionNumber: number;
  experimentRun?: ExperimentRun;
};

const mockExperimentRepetitions: Record<string, ExperimentRepetition[]> = {
  "exp-1": [
    {
      experimentId: "exp-1",
      repetitionNumber: 1,
      experimentRun: {
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
                metadata: null,
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
                metadata: null,
                trace: {
                  traceId: "eval-trace-exp1-2",
                  projectId: "project-456",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "exp-2": [
    {
      experimentId: "exp-2",
      repetitionNumber: 1,
      experimentRun: {
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
                metadata: null,
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
                metadata: null,
                trace: {
                  traceId: "eval-trace-exp2-2",
                  projectId: "project-789",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "exp-3": [
    {
      experimentId: "exp-3",
      repetitionNumber: 1,
      experimentRun: {
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
                metadata: null,
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
                metadata: null,
                trace: {
                  traceId: "eval-trace-exp3-2",
                  projectId: "project-123",
                },
              },
            },
          ],
        },
      },
    },
    {
      experimentId: "exp-3",
      repetitionNumber: 2,
      experimentRun: {
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
                metadata: null,
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
                metadata: null,
                trace: {
                  traceId: "eval-trace-exp3-4",
                  projectId: "project-123",
                },
              },
            },
          ],
        },
      },
    },
    {
      experimentId: "exp-3",
      repetitionNumber: 3,
      experimentRun: {
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
    },
  ],
  "exp-4": [
    {
      experimentId: "exp-4",
      repetitionNumber: 1,
      // No experimentRun - this repetition didn't run
    },
  ],
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

const mockReferenceOutput: ReferenceOutput = {
  query:
    "SELECT title, MAX(vote_average) AS highest_rating FROM movies WHERE credits LIKE '%Brad Pitt%' GROUP BY title ORDER BY highest_rating DESC LIMIT 1;",
  results: [{ title: "Fight Club", highest_rating: 8.8 }],
};

const meta: Meta<StoryArgs> = {
  title: "Experiment/ExperimentRunOutputs",
  component: ExperimentRunOutputs,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
A comprehensive component for displaying and comparing experiment run outputs:
- **Reference Output**: Shows the expected/ground truth output for comparison
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
};

export default meta;
type Story = StoryFn<StoryArgs>;

const Template: Story = (args) => {
  const includeRepetitions = Object.values(args.experimentsById).some(
    (experiment) => experiment.repetitions > 1
  );

  return (
    <View borderColor="light" borderWidth="thin">
      <ExperimentCompareDetailsProvider
        baseExperimentId={args.baseExperimentId}
        compareExperimentIds={args.compareExperimentIds}
        experimentsById={args.experimentsById}
        experimentRepetitionsByExperimentId={
          args.experimentRepetitionsByExperimentId
        }
        annotationSummaries={args.annotationSummaries}
        referenceOutput={args.referenceOutput}
        includeRepetitions={includeRepetitions}
        openTraceDialog={() => {}}
      >
        <ExperimentRunOutputs />
      </ExperimentCompareDetailsProvider>
    </View>
  );
};

/**
 * Default comparison with multiple experiments including successful runs
 */
export const Default = Template.bind({});
Default.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-3"],
  experimentsById: mockExperiments,
  experimentRepetitionsByExperimentId: mockExperimentRepetitions,
  annotationSummaries: mockAnnotationSummaries,
  referenceOutput: mockReferenceOutput,
};

/**
 * Comparison including an experiment with no runs
 */
export const WithNoRunExperiment = Template.bind({});
WithNoRunExperiment.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-3", "exp-4"],
  experimentsById: mockExperiments,
  experimentRepetitionsByExperimentId: mockExperimentRepetitions,
  annotationSummaries: mockAnnotationSummaries,
  referenceOutput: mockReferenceOutput,
};

/**
 * Single experiment comparison (base only)
 */
export const SingleExperiment = Template.bind({});
SingleExperiment.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: [],
  experimentsById: { "exp-1": mockExperiments["exp-1"] },
  experimentRepetitionsByExperimentId: {
    "exp-1": mockExperimentRepetitions["exp-1"],
  },
  annotationSummaries: mockAnnotationSummaries,
  referenceOutput: mockReferenceOutput,
};

/**
 * Comparison with experiments containing errors
 */
export const WithErrors = Template.bind({});
WithErrors.args = {
  baseExperimentId: "exp-2",
  compareExperimentIds: ["exp-3"],
  experimentsById: mockExperiments,
  experimentRepetitionsByExperimentId: mockExperimentRepetitions,
  annotationSummaries: mockAnnotationSummaries,
  referenceOutput: mockReferenceOutput,
};

const mockEdgeCaseExperiments: Record<string, Experiment> = {
  "edge-exp-1": {
    id: "edge-exp-1",
    name: "Mixed Annotation Types",
    repetitions: 3,
  },
  "edge-exp-2": {
    id: "edge-exp-2",
    name: "Long Labels Experiment",
    repetitions: 2,
  },
  "edge-exp-3": {
    id: "edge-exp-3",
    name: "Score vs Label Mix",
    repetitions: 1,
  },
};

const mockEdgeCaseRepetitions: Record<string, ExperimentRepetition[]> = {
  "edge-exp-1": [
    {
      experimentId: "edge-exp-1",
      repetitionNumber: 1,
      experimentRun: {
        id: "edge-run-1",
        repetitionNumber: 1,
        latencyMs: 1200,
        experimentId: "edge-exp-1",
        error: null,
        trace: {
          traceId: "edge-trace-1",
          projectId: "project-edge",
        },
        output: {
          result: "Mixed annotation test case 1",
        },
        costSummary: {
          total: {
            cost: 0.015,
            tokens: 250,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-1",
                name: "mixed_evaluation",
                label: "excellent_performance_with_detailed_analysis",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-1",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-2",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "This response demonstrates exceptional quality with comprehensive coverage of all requested topics, thorough analysis of edge cases, and clear explanations that would be easily understood by both technical and non-technical stakeholders. The formatting is professional and the examples provided are highly relevant.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-2",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
    {
      experimentId: "edge-exp-1",
      repetitionNumber: 2,
      experimentRun: {
        id: "edge-run-2",
        repetitionNumber: 2,
        latencyMs: 1100,
        experimentId: "edge-exp-1",
        error: null,
        trace: {
          traceId: "edge-trace-2",
          projectId: "project-edge",
        },
        output: {
          result: "Mixed annotation test case 2",
        },
        costSummary: {
          total: {
            cost: 0.012,
            tokens: 200,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-3",
                name: "mixed_evaluation",
                label: null,
                score: 0.87,
                metadata: null,
                trace: {
                  traceId: "edge-eval-3",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-4",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "The response quality is good but could benefit from more specific examples and clearer structure in the presentation of complex concepts.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-4",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
    {
      experimentId: "edge-exp-1",
      repetitionNumber: 3,
      experimentRun: {
        id: "edge-run-3",
        repetitionNumber: 3,
        latencyMs: 1300,
        experimentId: "edge-exp-1",
        error: null,
        trace: {
          traceId: "edge-trace-3",
          projectId: "project-edge",
        },
        output: {
          result: "Mixed annotation test case 3",
        },
        costSummary: {
          total: {
            cost: 0.018,
            tokens: 290,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-5",
                name: "mixed_evaluation",
                label: null,
                score: 0.92,
                metadata: null,
                trace: {
                  traceId: "edge-eval-5",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-6",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label: null,
                score: 0.85,
                metadata: null,
                trace: {
                  traceId: "edge-eval-6",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "edge-exp-2": [
    {
      experimentId: "edge-exp-2",
      repetitionNumber: 1,
      experimentRun: {
        id: "edge-run-4",
        repetitionNumber: 1,
        latencyMs: 950,
        experimentId: "edge-exp-2",
        error: null,
        trace: {
          traceId: "edge-trace-4",
          projectId: "project-edge",
        },
        output: {
          result: "Long labels test case 1",
        },
        costSummary: {
          total: {
            cost: 0.009,
            tokens: 150,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-7",
                name: "mixed_evaluation",
                label:
                  "needs_significant_improvement_across_multiple_dimensions",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-7",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-8",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "While the response attempts to address the core requirements, it falls short in several critical areas including lack of specific examples, insufficient depth of analysis, unclear explanations that may confuse readers, and formatting issues that detract from the overall presentation quality and professional appearance.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-8",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
    {
      experimentId: "edge-exp-2",
      repetitionNumber: 2,
      experimentRun: {
        id: "edge-run-5",
        repetitionNumber: 2,
        latencyMs: 1050,
        experimentId: "edge-exp-2",
        error: null,
        trace: {
          traceId: "edge-trace-5",
          projectId: "project-edge",
        },
        output: {
          result: "Long labels test case 2",
        },
        costSummary: {
          total: {
            cost: 0.011,
            tokens: 180,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-9",
                name: "mixed_evaluation",
                label: null,
                score: 0.65,
                metadata: null,
                trace: {
                  traceId: "edge-eval-9",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-10",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "The response demonstrates moderate quality with some good insights but requires refinement in organization, clarity of technical explanations, and inclusion of more comprehensive examples to fully meet the specified requirements and expectations for this type of analysis.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-10",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "edge-exp-3": [
    {
      experimentId: "edge-exp-3",
      repetitionNumber: 1,
      experimentRun: {
        id: "edge-run-6",
        repetitionNumber: 1,
        latencyMs: 800,
        experimentId: "edge-exp-3",
        error: null,
        trace: {
          traceId: "edge-trace-6",
          projectId: "project-edge",
        },
        output: {
          result: "Score vs label mix test case",
        },
        costSummary: {
          total: {
            cost: 0.007,
            tokens: 120,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "edge-ann-11",
                name: "mixed_evaluation",
                label: "outstanding_with_exceptional_detail",
                score: null,
                metadata: null,
                trace: {
                  traceId: "edge-eval-11",
                  projectId: "project-edge",
                },
              },
            },
            {
              annotation: {
                id: "edge-ann-12",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label: null,
                score: 0.95,
                metadata: null,
                trace: {
                  traceId: "edge-eval-12",
                  projectId: "project-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
};

// Mock data for single repetition edge cases
const mockSingleRepetitionEdgeCaseExperiments: Record<string, Experiment> = {
  "single-edge-exp-1": {
    id: "single-edge-exp-1",
    name: "Single Rep Mixed Types",
    repetitions: 1,
  },
  "single-edge-exp-2": {
    id: "single-edge-exp-2",
    name: "Single Rep Long Labels",
    repetitions: 1,
  },
  "single-edge-exp-3": {
    id: "single-edge-exp-3",
    name: "Single Rep Score vs Label",
    repetitions: 1,
  },
};

const mockSingleRepetitionEdgeCaseRepetitions: Record<
  string,
  ExperimentRepetition[]
> = {
  "single-edge-exp-1": [
    {
      experimentId: "single-edge-exp-1",
      repetitionNumber: 1,
      experimentRun: {
        id: "single-edge-run-1",
        repetitionNumber: 1,
        latencyMs: 1100,
        experimentId: "single-edge-exp-1",
        error: null,
        trace: {
          traceId: "single-edge-trace-1",
          projectId: "project-single-edge",
        },
        output: {
          result: "Single repetition mixed annotation types",
        },
        costSummary: {
          total: {
            cost: 0.013,
            tokens: 220,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "single-edge-ann-1",
                name: "mixed_evaluation",
                label: "satisfactory_with_room_for_improvement",
                score: null,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-1",
                  projectId: "project-single-edge",
                },
              },
            },
            {
              annotation: {
                id: "single-edge-ann-2",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "The analysis provides a solid foundation but would benefit from deeper exploration of edge cases, more comprehensive examples, and clearer articulation of the methodology used to arrive at the conclusions presented in this evaluation.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-2",
                  projectId: "project-single-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "single-edge-exp-2": [
    {
      experimentId: "single-edge-exp-2",
      repetitionNumber: 1,
      experimentRun: {
        id: "single-edge-run-2",
        repetitionNumber: 1,
        latencyMs: 900,
        experimentId: "single-edge-exp-2",
        error: null,
        trace: {
          traceId: "single-edge-trace-2",
          projectId: "project-single-edge",
        },
        output: {
          result: "Single repetition with long labels",
        },
        costSummary: {
          total: {
            cost: 0.008,
            tokens: 140,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "single-edge-ann-3",
                name: "mixed_evaluation",
                label: null,
                score: 0.78,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-3",
                  projectId: "project-single-edge",
                },
              },
            },
            {
              annotation: {
                id: "single-edge-ann-4",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label:
                  "This response demonstrates competent handling of the basic requirements but lacks the sophistication and thoroughness expected for this level of analysis, particularly in areas of technical depth, contextual understanding, and practical application examples that would make the content more valuable to end users.",
                score: null,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-4",
                  projectId: "project-single-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
  "single-edge-exp-3": [
    {
      experimentId: "single-edge-exp-3",
      repetitionNumber: 1,
      experimentRun: {
        id: "single-edge-run-3",
        repetitionNumber: 1,
        latencyMs: 1250,
        experimentId: "single-edge-exp-3",
        error: null,
        trace: {
          traceId: "single-edge-trace-3",
          projectId: "project-single-edge",
        },
        output: {
          result: "Single repetition score vs label comparison",
        },
        costSummary: {
          total: {
            cost: 0.016,
            tokens: 270,
          },
        },
        annotations: {
          edges: [
            {
              annotation: {
                id: "single-edge-ann-5",
                name: "mixed_evaluation",
                label: "exceptional_quality_exceeds_expectations",
                score: null,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-5",
                  projectId: "project-single-edge",
                },
              },
            },
            {
              annotation: {
                id: "single-edge-ann-6",
                name: "detailed_feedback_and_an_annotation_with_a_really_long_name",
                label: null,
                score: 0.96,
                metadata: null,
                trace: {
                  traceId: "single-edge-eval-6",
                  projectId: "project-single-edge",
                },
              },
            },
          ],
        },
      },
    },
  ],
};

const mockEdgeCaseAnnotationSummaries: AnnotationSummaries = [
  {
    annotationName: "mixed_evaluation",
    minScore: 0.0,
    maxScore: 1.0,
  },
  {
    annotationName:
      "detailed_feedback_and_an_annotation_with_a_really_long_name",
    minScore: 0.0,
    maxScore: 1.0,
  },
];

const mockEdgeCaseReferenceOutput: ReferenceOutput = {
  result:
    "Expected comprehensive analysis with detailed explanations, proper formatting, and relevant examples that demonstrate thorough understanding of the topic.",
};

/**
 * Annotation edge cases with multiple repetitions - demonstrates mixed score/label types and long labels
 */
export const AnnotationEdgeCases = Template.bind({});
AnnotationEdgeCases.args = {
  baseExperimentId: "edge-exp-1",
  compareExperimentIds: ["edge-exp-2", "edge-exp-3"],
  experimentsById: mockEdgeCaseExperiments,
  experimentRepetitionsByExperimentId: mockEdgeCaseRepetitions,
  annotationSummaries: mockEdgeCaseAnnotationSummaries,
  referenceOutput: mockEdgeCaseReferenceOutput,
};

/**
 * Annotation edge cases with single repetitions - same edge cases but each experiment has only one repetition
 */
export const AnnotationEdgeCasesSingleRepetition = Template.bind({});
AnnotationEdgeCasesSingleRepetition.args = {
  baseExperimentId: "single-edge-exp-1",
  compareExperimentIds: ["single-edge-exp-2", "single-edge-exp-3"],
  experimentsById: mockSingleRepetitionEdgeCaseExperiments,
  experimentRepetitionsByExperimentId: mockSingleRepetitionEdgeCaseRepetitions,
  annotationSummaries: mockEdgeCaseAnnotationSummaries,
  referenceOutput: mockEdgeCaseReferenceOutput,
};

/**
 * Comparison without reference output - demonstrates the interface when no ground truth is available
 */
export const WithoutReferenceOutput = Template.bind({});
WithoutReferenceOutput.args = {
  baseExperimentId: "exp-1",
  compareExperimentIds: ["exp-2", "exp-3"],
  experimentsById: mockExperiments,
  experimentRepetitionsByExperimentId: mockExperimentRepetitions,
  annotationSummaries: mockAnnotationSummaries,
  referenceOutput: null,
};
