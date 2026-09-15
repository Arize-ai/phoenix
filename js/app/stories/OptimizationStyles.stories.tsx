import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { OptimizationDirectionIndicator } from "@phoenix/components/annotation/OptimizationDirectionIndicator";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

const DIRECTIONS = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
] satisfies readonly EvaluatorOptimizationDirection[];

const SCORE_STYLES = [
  { label: "Favorable", score: 0.9, positiveOptimization: true },
  { label: "Unfavorable", score: 0.1, positiveOptimization: false },
  { label: "Neutral", score: 0.5, positiveOptimization: null },
] as const;

const meta = {
  title: "Annotation/Optimization Styles",
  parameters: {
    layout: "centered",
    themeLayout: "row",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStyles: Story = {
  render: () => (
    <Flex direction="row" gap="size-400" alignItems="start">
      <Flex direction="column" gap="size-100" alignItems="start">
        <Text elementType="h3" size="S" weight="heavy">
          Directions
        </Text>
        {DIRECTIONS.map((direction) => (
          <OptimizationDirectionIndicator
            key={direction}
            optimizationDirection={direction}
          />
        ))}
      </Flex>
      <Flex direction="column" gap="size-100" alignItems="start">
        <Text elementType="h3" size="S" weight="heavy">
          Scores
        </Text>
        {SCORE_STYLES.map(({ label, score, positiveOptimization }) => (
          <Flex key={label} direction="row" gap="size-100" alignItems="center">
            <Text size="S" color="text-500">
              {label}
            </Text>
            <AnnotationScoreText
              elementType="span"
              fontFamily="mono"
              size="S"
              positiveOptimization={positiveOptimization}
            >
              {score}
            </AnnotationScoreText>
          </Flex>
        ))}
      </Flex>
    </Flex>
  ),
};
