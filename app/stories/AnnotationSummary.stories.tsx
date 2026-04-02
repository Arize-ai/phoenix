import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Skeleton, Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  SummaryValue,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";

/**
 * Compares the annotation summary skeleton fallback side-by-side with loaded
 * states so we can verify there is no layout shift when Suspense resolves.
 */
const meta: Meta = {
  title: "Annotation/AnnotationSummary",
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj;

const LABEL_FRACTIONS = [
  { label: "Good", fraction: 0.6 },
  { label: "Bad", fraction: 0.3 },
  { label: "Neutral", fraction: 0.1 },
];

function SummaryShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        <Truncate maxWidth="120px">{name}</Truncate>
      </Text>
      {children}
    </Flex>
  );
}

function SkeletonFallback() {
  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      <Skeleton width={24} height={24} borderRadius="circle" />
      <Skeleton width={50} height="1.2em" />
    </Flex>
  );
}

/**
 * Shows the skeleton fallback next to loaded states to verify alignment.
 * The skeleton should match the height and approximate width of each loaded variant.
 */
export const SkeletonVsLoaded: Story = {
  render: () => (
    <Flex direction="row" gap="size-400" alignItems="start">
      <SummaryShell name="Skeleton">
        <SkeletonFallback />
      </SummaryShell>
      <SummaryShell name="Score + Pie">
        <SummaryValuePreview
          name="correctness"
          meanScore={0.85}
          labelFractions={LABEL_FRACTIONS}
          disableAnimation
        />
      </SummaryShell>
      <SummaryShell name="Score Only">
        <SummaryValuePreview
          name="relevance"
          meanScore={0.72}
          disableAnimation
        />
      </SummaryShell>
      <SummaryShell name="No Data">
        <SummaryValuePreview name="empty" disableAnimation />
      </SummaryShell>
    </Flex>
  ),
};

/**
 * Full SummaryValue with tooltip support, showing all annotation variants.
 */
export const LoadedVariants: Story = {
  render: () => (
    <Flex direction="row" gap="size-400" alignItems="start">
      <SummaryShell name="correctness">
        <SummaryValue
          name="correctness"
          meanScore={0.85}
          labelFractions={LABEL_FRACTIONS}
          disableAnimation
        />
      </SummaryShell>
      <SummaryShell name="relevance">
        <SummaryValue name="relevance" meanScore={0.72} disableAnimation />
      </SummaryShell>
      <SummaryShell name="no data">
        <SummaryValue name="empty" disableAnimation />
      </SummaryShell>
    </Flex>
  ),
};
