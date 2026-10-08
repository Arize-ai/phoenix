import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import { useExperimentColors } from "@phoenix/components/experiment";
import { AnnotationValueItem } from "@phoenix/pages/experiment/ExperimentCompareListPage";

import { annotationConfigsByName } from "../../constants/annotationFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

type RunAnnotation = {
  name: string;
  score: number | null;
  label: string | null;
};

const answerSimilarityConfig: AnnotationOptimizationConfig = {
  annotationType: "FREEFORM",
  optimizationDirection: "MAXIMIZE",
  threshold: 0.5,
};

const confidenceConfig: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "NONE",
  lowerBound: 0,
  upperBound: 1,
};

const scores = [0.9, 0.62, 0.5, 0.31, 1.3];
const minScore = Math.min(...scores);
const maxScore = Math.max(...scores);

function ScoreCell({ children }: { children: ReactNode }) {
  return (
    <ul
      css={css`
        width: 200px;
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-25);
      `}
    >
      {children}
    </ul>
  );
}

function BaselineItem({
  annotationName,
  annotation,
  config,
  minScore,
  maxScore,
}: {
  annotationName: string;
  annotation: RunAnnotation | undefined;
  config: AnnotationOptimizationConfig | undefined;
  minScore: number | null;
  maxScore: number | null;
}) {
  const { baseExperimentColor } = useExperimentColors();
  return (
    <AnnotationValueItem
      annotation={annotation}
      annotationConfig={config}
      barColor={baseExperimentColor}
      minScore={minScore}
      maxScore={maxScore}
      annotationName={annotationName}
    />
  );
}

function CompareCell({
  annotationName,
  baseScore,
  compareScores,
}: {
  annotationName: string;
  baseScore: number;
  compareScores: number[];
}) {
  const { getExperimentColor } = useExperimentColors();
  const config = annotationConfigsByName.get(annotationName);
  return (
    <ScoreCell>
      <BaselineItem
        annotationName={annotationName}
        annotation={{ name: annotationName, score: baseScore, label: null }}
        config={config}
        minScore={0}
        maxScore={1}
      />
      {compareScores.map((score, index) => (
        <AnnotationValueItem
          key={index}
          annotation={{ name: annotationName, score, label: null }}
          annotationConfig={config}
          barColor={getExperimentColor(index)}
          minScore={0}
          maxScore={1}
          annotationName={annotationName}
        />
      ))}
    </ScoreCell>
  );
}

/**
 * An annotation's value for one experiment in a cell of the experiment
 * compare list, with the baseline experiment first. The value is graded by
 * the evaluator's optimization direction, strongest at the bounds and
 * neutral at the pivot, while the bar keeps the experiment's color and spans
 * the lowest to highest score across the compared runs.
 */
const meta: Meta<typeof AnnotationValueItem> = {
  title: "Domains/Experiments/Annotation Value Item",
  tags: ["updated", "complete", "unreviewed"],
  component: AnnotationValueItem,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationValueItem>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <CompareCell
      annotationName="faithfulness"
      baseScore={0.62}
      compareScores={[0.9, 0.31]}
    />
  ),
};

export const Scores: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={scores.map((score) => ({
        label: String(score),
        code: true,
        score,
      }))}
      columns={[
        {
          label: "Maximize, 0 to 1",
          name: "faithfulness",
          config: annotationConfigsByName.get("faithfulness"),
        },
        {
          label: "Minimize, 0 to 1",
          name: "toxicity",
          config: annotationConfigsByName.get("toxicity"),
        },
        {
          label: "Maximize, threshold 0.5",
          name: "answer_similarity",
          config: answerSimilarityConfig,
        },
        {
          label: "No direction",
          name: "confidence",
          config: confidenceConfig,
        },
      ]}
      renderCell={(row, column) =>
        column ? (
          <ScoreCell>
            <BaselineItem
              annotationName={column.name}
              annotation={{ name: column.name, score: row.score, label: null }}
              config={column.config}
              minScore={minScore}
              maxScore={maxScore}
            />
          </ScoreCell>
        ) : null
      }
    />
  ),
};

export const ValueTypes: Story = {
  name: "Value Types",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <OptionGrid
      rows={[
        {
          label: "Categorical, maximize",
          annotation: { name: "qa_correctness", score: 1, label: "correct" },
          config: annotationConfigsByName.get("qa_correctness"),
        },
        {
          label: "Categorical, minimize",
          annotation: {
            name: "hallucination",
            score: 1,
            label: "hallucinated",
          },
          config: annotationConfigsByName.get("hallucination"),
        },
        {
          label: "Label only",
          annotation: { name: "tone", score: null, label: "formal" },
          config: annotationConfigsByName.get("tone"),
        },
        {
          label: "Long label",
          annotation: {
            name: "tone",
            score: null,
            label: "formal with occasional condescension",
          },
          config: annotationConfigsByName.get("tone"),
        },
        {
          label: "No config",
          annotation: { name: "exact_match", score: 0.62, label: null },
          config: undefined,
        },
        {
          label: "Not annotated",
          annotation: undefined,
          config: annotationConfigsByName.get("faithfulness"),
        },
      ]}
      renderCell={(row) => (
        <ScoreCell>
          <BaselineItem
            annotationName={row.annotation?.name ?? "faithfulness"}
            annotation={row.annotation}
            config={row.config}
            minScore={0}
            maxScore={1}
          />
        </ScoreCell>
      )}
    />
  ),
};

export const Thumbnail: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
};
