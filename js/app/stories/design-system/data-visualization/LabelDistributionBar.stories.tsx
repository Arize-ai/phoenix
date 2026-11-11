import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  ANNOTATION_LABEL_ACCENT_COLOR,
  extendAnnotationLabelColors,
  getAnnotationLabelColor,
  useAnnotationLabelColors,
} from "@phoenix/components/annotation/annotationLabelColors";
import {
  LabelDistributionBar,
  type LabelDistributionBarSegment,
  Sparkline,
} from "@phoenix/components/chart";

/** The evaluators table caps the sparkline, and the bar beside it, at this. */
const CELL_MAX_WIDTH = 160;

type LabelShare = { label: string; fraction: number };

/**
 * Colors a distribution the way the evaluators table does: a neutral indigo
 * accent for its first label, grays for the rest, and a count per label
 * from the labeled-annotation total.
 */
function useSegments({
  annotationName,
  shares,
  labelCount,
}: {
  annotationName: string;
  shares: LabelShare[];
  labelCount: number;
}): LabelDistributionBarSegment[] {
  const colors = extendAnnotationLabelColors(
    useAnnotationLabelColors(annotationName, {
      primaryColor: ANNOTATION_LABEL_ACCENT_COLOR,
    }),
    shares.length
  );
  return shares.map((share, index) => ({
    ...share,
    count: Math.round(share.fraction * labelCount),
    color: getAnnotationLabelColor(colors, index, share.label),
  }));
}

function Bar({
  annotationName,
  shares,
  labelCount = 300,
  priorFraction,
}: {
  annotationName: string;
  shares: LabelShare[];
  labelCount?: number;
  /** The first label's share in the previous 7d, drawn as a tick. */
  priorFraction?: number;
}) {
  const segments = useSegments({ annotationName, shares, labelCount });
  return (
    <LabelDistributionBar
      segments={segments}
      prior={
        priorFraction == null
          ? null
          : {
              label: shares[0].label,
              fraction: priorFraction,
              description: "in the previous 7d",
            }
      }
      maxWidth={CELL_MAX_WIDTH}
      aria-label={`${annotationName} labels over the last 7d`}
      tooltipHeader={
        <Text size="S" color="text-700">
          {annotationName} labels, last 7d
        </Text>
      }
    />
  );
}

/** A labeled row: a caption beside a chart held at a fixed width. */
function Row({
  label,
  width = CELL_MAX_WIDTH,
  children,
}: {
  label: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-200">
      <div style={{ width: 220, flex: "none" }}>
        <Text size="S" color="text-700">
          {label}
        </Text>
      </div>
      <div style={{ width, flex: "none", display: "flex" }}>{children}</div>
    </Flex>
  );
}

const meta: Meta<typeof LabelDistributionBar> = {
  title: "Design System/Data visualization/LabelDistributionBar",
  component: LabelDistributionBar,
  parameters: {
    inset: true,
    docs: {
      description: {
        component: [
          "A label distribution as one horizontal stacked bar, for table cells where a score would get a `Sparkline`. Each label is a segment sized by its share; a label with a sliver of a share is still drawn wide enough to see and hover.",
          "",
          "**Order and color by label, not by share.** Pass the segments in a stable order (the annotation config's label order) and give each label a color that does not depend on the row, so the same label sits in the same place in the same color on every row and in every window. The evaluators table uses `useAnnotationLabelColors` and `getAnnotationLabelColor`, the same helpers the annotation summary tooltip uses, so a bar and the tooltip beside it agree.",
          "",
          "**A tick marks the prior.** Pass `prior` (a label's share in an earlier period) and a tick crosses the bar at that share of its width, so the reader sees where the segment's edge was. The evaluators table passes the leading label's share in the previous window.",
          "",
          '**A legend of percents runs under the bar.** One swatch and whole-number percent per label, no names (the tooltip has them). Items that don\'t fit the width collapse into "+N".',
          "",
          "**Hover for the numbers.** Hovering shows every label's share and count, with the hovered label emphasized and the rest dimmed.",
          "",
          "**It lines up with a Sparkline.** It grows to `maxWidth` the same way, so a label-only row and a score row end at the same right edge in one column. The bar, tick and legend together stand a little taller than a sparkline but within a table row's height.",
        ].join("\n"),
      },
    },
  },
  tags: ["updated", "incomplete", "unreviewed"],
};

export default meta;
type Story = StoryObj<typeof LabelDistributionBar>;

/**
 * A yes/no evaluator at the evaluators table's width. Hover a segment for
 * each label's share and count.
 */
export const Default: Story = {
  render: () => (
    <div style={{ width: CELL_MAX_WIDTH, display: "flex" }}>
      <Bar
        annotationName="is_correct"
        shares={[
          { label: "correct", fraction: 0.82 },
          { label: "incorrect", fraction: 0.18 },
        ]}
      />
    </div>
  ),
};

/**
 * Two to five labels. Past the first label the palette runs through grays,
 * so the label that matters keeps the accent and the rest read
 * as its complement. A label with a sliver of a share stays visible.
 */
export const LabelCounts: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      <Row label="2 labels">
        <Bar
          annotationName="is_correct"
          shares={[
            { label: "correct", fraction: 0.7 },
            { label: "incorrect", fraction: 0.3 },
          ]}
        />
      </Row>
      <Row label="3 labels">
        <Bar
          annotationName="tone"
          shares={[
            { label: "positive", fraction: 0.5 },
            { label: "neutral", fraction: 0.36 },
            { label: "negative", fraction: 0.14 },
          ]}
        />
      </Row>
      <Row label="5 labels">
        <Bar
          annotationName="relevance_grade"
          shares={[
            { label: "A", fraction: 0.3 },
            { label: "B", fraction: 0.28 },
            { label: "C", fraction: 0.22 },
            { label: "D", fraction: 0.12 },
            { label: "F", fraction: 0.08 },
          ]}
        />
      </Row>
      <Row label="a 0.5% sliver">
        <Bar
          annotationName="toxicity"
          shares={[
            { label: "safe", fraction: 0.995 },
            { label: "toxic", fraction: 0.005 },
          ]}
          labelCount={2000}
        />
      </Row>
      <Row label="one label">
        <Bar
          annotationName="is_correct"
          shares={[{ label: "correct", fraction: 1 }]}
        />
      </Row>
    </Flex>
  ),
};

/**
 * The leading label's share now and in the previous window: "correct" holds
 * 71% now, and the tick at 83% shows it held more of the bar last week. A
 * tick inside the first segment means the share grew.
 */
export const WithPrior: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      <Row label="share fell (83% → 71%)">
        <Bar
          annotationName="is_correct"
          shares={[
            { label: "correct", fraction: 0.71 },
            { label: "incorrect", fraction: 0.29 },
          ]}
          priorFraction={0.83}
        />
      </Row>
      <Row label="share grew (38% → 50%)">
        <Bar
          annotationName="tone"
          shares={[
            { label: "positive", fraction: 0.5 },
            { label: "neutral", fraction: 0.37 },
            { label: "negative", fraction: 0.13 },
          ]}
          priorFraction={0.38}
        />
      </Row>
      <Row label="no prior data">
        <Bar
          annotationName="is_correct"
          shares={[
            { label: "correct", fraction: 0.71 },
            { label: "incorrect", fraction: 0.29 },
          ]}
        />
      </Row>
    </Flex>
  ),
};

/**
 * More labels than the legend has room for: it shows as many percents as
 * fit the bar's width and sums up the rest as "+N". Hover for every label.
 */
export const ManyLabels: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      {[160, 100].map((width) => (
        <Row key={width} label={`9 labels at ${width}px`} width={width}>
          <Bar
            annotationName="topic"
            shares={[
              { label: "billing", fraction: 0.24 },
              { label: "shipping", fraction: 0.18 },
              { label: "returns", fraction: 0.14 },
              { label: "account", fraction: 0.12 },
              { label: "product", fraction: 0.1 },
              { label: "warranty", fraction: 0.08 },
              { label: "privacy", fraction: 0.06 },
              { label: "feedback", fraction: 0.05 },
              { label: "other", fraction: 0.03 },
            ]}
            priorFraction={0.2}
          />
        </Row>
      ))}
    </Flex>
  ),
};

/**
 * A score row and a label row as the evaluators table stacks them: the bar
 * takes the sparkline's width, so the column stays aligned.
 */
export const BesideASparkline: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      <Row label="relevance (scores)">
        <Sparkline
          values={[0.62, 0.7, 0.66, null, 0.74, 0.71, 0.69, 0.75]}
          minRange={0.2}
          maxWidth={CELL_MAX_WIDTH}
          color="var(--global-text-color-900)"
          coverageColor="var(--global-text-color-300)"
          showCoverage
        />
      </Row>
      <Row label="is_correct (labels)">
        <Bar
          annotationName="is_correct"
          shares={[
            { label: "correct", fraction: 0.71 },
            { label: "incorrect", fraction: 0.29 },
          ]}
          priorFraction={0.83}
        />
      </Row>
    </Flex>
  ),
};

/** The bar grows with its container up to `maxWidth`, then stops. */
export const Widths: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      {[320, 160, 100, 60].map((width) => (
        <Row key={width} label={`${width}px container`} width={width}>
          <Bar
            annotationName="tone"
            shares={[
              { label: "positive", fraction: 0.5 },
              { label: "neutral", fraction: 0.36 },
              { label: "negative", fraction: 0.14 },
            ]}
          />
        </Row>
      ))}
    </Flex>
  ),
};
