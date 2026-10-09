import type { Meta, StoryObj } from "@storybook/react";

import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import {
  type AnnotationOptimizationConfig,
  getOptimizationValueFromConfig,
} from "@phoenix/components/annotation/optimizationUtils";
import type { Annotation } from "@phoenix/components/annotation/types";
import type { TextSize } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

const SIZES: readonly { label: TextSize; code: true }[] = [
  { label: "XS", code: true },
  { label: "S", code: true },
  { label: "M", code: true },
];

const OPTIMIZATION_VALUES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(
  (value) => ({ label: String(value), code: true, value })
);

const GRADIENT_STOPS = Array.from({ length: 21 }, (_, index) => {
  const value = (10 - index) / 10;
  return { label: String(value), code: true, value };
});

const GRADE_VALUES = ["F", "D", "D+", "C-", "C", "C+", "B-", "B", "A"].map(
  (label, index) => ({ label, score: index + 1 })
);

const GRADE_CONFIG: AnnotationOptimizationConfig = {
  annotationType: "CATEGORICAL",
  optimizationDirection: "MAXIMIZE",
  values: GRADE_VALUES,
};

const CORRECTNESS_CONFIG: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

type ValueContent = {
  label: string;
  config: AnnotationOptimizationConfig;
  annotationAt: (step: number) => Annotation;
};

const VALUE_CONTENTS: readonly ValueContent[] = [
  {
    label: "Score",
    config: CORRECTNESS_CONFIG,
    annotationAt: (step) => ({ name: "correctness", score: step / 8 }),
  },
  {
    label: "Label and score",
    config: GRADE_CONFIG,
    annotationAt: (step) => ({
      name: "grade",
      ...GRADE_VALUES[step],
    }),
  },
  {
    label: "Label",
    config: GRADE_CONFIG,
    annotationAt: (step) => ({
      name: "grade",
      label: GRADE_VALUES[step].label,
    }),
  },
  {
    label: "No score or label",
    config: GRADE_CONFIG,
    annotationAt: () => ({ name: "grade" }),
  },
];

const VALUE_POSITIONS = [
  ...OPTIMIZATION_VALUES.map(({ label }, step) => ({
    label,
    code: true,
    step,
    hasDirection: true,
  })),
  { label: "No direction", step: 6, hasDirection: false },
];

/**
 * A score colored by how it compares with the annotation's optimization
 * direction. `optimizationValue`, from `getOptimizationValue`, grades the
 * color from the worst bound (`-1`) through the pivot (`0`) to the best bound
 * (`1`). A score on a side of the pivot with no bound, such as one judged
 * only against a freeform threshold, is `1` or `-1`. A score with no
 * optimization value stays uncolored.
 *
 * `AnnotationNameAndValue` wraps a label and a score in one
 * `AnnotationScoreText`, so the label takes the score's color. The value
 * comes from the score, so a label without one is never colored.
 */
const meta: Meta<typeof AnnotationScoreText> = {
  title: "Domains/Annotations/Annotation Score Text",
  tags: ["updated", "complete", "unreviewed"],
  component: AnnotationScoreText,
  subcomponents: { AnnotationNameAndValue },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationScoreText>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <AnnotationScoreText fontFamily="mono" optimizationValue={0.6}>
      0.80
    </AnnotationScoreText>
  ),
};

export const OptimizationValuesAndSizes: Story = {
  name: "Optimization Values and Sizes",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={GRADIENT_STOPS}
      columns={SIZES}
      renderCell={(row, size) => (
        <AnnotationScoreText
          fontFamily="mono"
          size={size?.label}
          optimizationValue={row.value}
        >
          {row.value.toFixed(2)}
        </AnnotationScoreText>
      )}
    />
  ),
};

export const LabelsAndScores: Story = {
  name: "Labels and Scores",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={VALUE_POSITIONS}
      columns={VALUE_CONTENTS}
      renderCell={(position, content) => {
        if (!content) {
          return null;
        }
        const config: AnnotationOptimizationConfig = position.hasDirection
          ? content.config
          : { ...content.config, optimizationDirection: "NONE" };
        const annotation = content.annotationAt(position.step);
        return (
          <AnnotationNameAndValue
            annotation={annotation}
            displayPreference="score-and-label"
            maxWidth="unset"
            showColorSwatch={false}
            optimizationValue={getOptimizationValueFromConfig({
              config,
              score: annotation.score,
            })}
          />
        );
      }}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <OptionGrid
      columns={OPTIMIZATION_VALUES.filter((_, index) => index % 2 === 0)}
      renderCell={(_, column) => (
        <AnnotationScoreText
          fontFamily="mono"
          optimizationValue={column?.value}
        >
          {column?.value.toFixed(2)}
        </AnnotationScoreText>
      )}
    />
  ),
};
