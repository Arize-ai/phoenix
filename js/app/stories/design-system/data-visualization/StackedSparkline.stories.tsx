import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  getAnnotationLabelColor,
  useLabelDistributionColors,
} from "@phoenix/components/annotation/annotationLabelColors";
import {
  ChartTooltipItem,
  Sparkline,
  StackedSparkline,
  type StackedSparklineBinDetail,
  type StackedSparklineCategory,
} from "@phoenix/components/chart";
import { RESULTS_CHART_WIDTH as CHART_WIDTH } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMeanScoreCell";

/**
 * A repeatable pseudo-random sequence in [0, 1), so the fixtures look like
 * live data yet render the same on every load.
 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

type Fixture = {
  labels: string[];
  /** Per bin: each label's share, or null for an empty bin. */
  values: (number[] | null)[];
  /** Per bin: how many results the shares are of. */
  weights: number[];
};

/**
 * Daily label shares the way a label-only evaluator produces them: a
 * leading label that drifts, the rest splitting what's left, a few empty
 * days, and an empty tail because the evaluator stopped running.
 */
function createDailyFixture({
  labels,
  seed,
  days = 14,
  emptyTailDays = 2,
}: {
  labels: string[];
  seed: number;
  days?: number;
  emptyTailDays?: number;
}): Fixture {
  const random = createRandom(seed);
  const values: (number[] | null)[] = [];
  const weights: number[] = [];
  let leading = 0.7;
  for (let day = 0; day < days; day++) {
    leading = Math.min(0.9, Math.max(0.3, leading + (random() - 0.5) * 0.15));
    if (day >= days - emptyTailDays || random() < 0.1) {
      values.push(null);
      weights.push(0);
      continue;
    }
    const rest = labels.slice(1).map(() => random() + 0.2);
    const restTotal = rest.reduce((sum, share) => sum + share, 0);
    values.push([
      leading,
      ...rest.map((share) => ((1 - leading) * share) / restTotal),
    ]);
    weights.push(5 + Math.floor(random() * 40));
  }
  return { labels, values, weights };
}

/** Colors the labels the way the evaluators table does. */
function useCategories(labels: string[]): StackedSparklineCategory[] {
  const colors = useLabelDistributionColors(labels.length);
  return labels.map((label, index) => ({
    key: label,
    color: getAnnotationLabelColor(colors, index, label),
  }));
}

function describeBin(
  categories: StackedSparklineCategory[],
  { range, shares, weight }: StackedSparklineBinDetail
): ReactNode {
  return (
    <Flex direction="column" gap="size-50">
      <Text size="S">
        {range.start === range.end
          ? `day ${range.start}`
          : `days ${range.start}–${range.end}`}{" "}
        · n={weight}
      </Text>
      <ul>
        {categories.map((category, index) =>
          shares[index] > 0 ? (
            <li key={category.key}>
              <ChartTooltipItem
                color={category.color}
                shape="square"
                name={category.key}
                value={`${Math.round(shares[index] * 100)}% · n=${Math.round(shares[index] * weight)}`}
              />
            </li>
          ) : null
        )}
      </ul>
    </Flex>
  );
}

function Columns({
  annotationName,
  fixture,
  maxWidth = CHART_WIDTH,
}: {
  annotationName: string;
  fixture: Fixture;
  maxWidth?: number;
}) {
  const categories = useCategories(fixture.labels);
  return (
    <StackedSparkline
      categories={categories}
      values={fixture.values}
      weights={fixture.weights}
      maxWidth={maxWidth}
      aria-label={`${annotationName} labels per day`}
      renderBinDetail={(detail) => describeBin(categories, detail)}
    />
  );
}

/** A labeled row: a caption beside a chart held at a fixed width. */
function Row({
  label,
  width = CHART_WIDTH,
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

const YES_NO = createDailyFixture({
  labels: ["correct", "incorrect"],
  seed: 3,
});
const THREE_LABELS = createDailyFixture({
  labels: ["positive", "neutral", "negative"],
  seed: 11,
});

const meta: Meta<typeof StackedSparkline> = {
  title: "Design System/Data visualization/Stacked Sparkline",
  component: StackedSparkline,
  parameters: {
    inset: true,
    docs: {
      description: {
        component: [
          "A small stacked-column chart for table cells: one column per time bin, each split into its categories' shares. The categorical counterpart of `Sparkline`, for an evaluator that writes labels rather than scores.",
          "",
          "**It shares the Sparkline's time axis.** Columns sit at the Sparkline's x positions and merge bins the same way at the same width, so a label row and a score row line up bin for bin when both charts get the same width. Empty bins stay blank, so a series that stops early visibly stops short.",
          "",
          "**Merged columns are weighted.** When the width can't give every bin 4px, adjacent bins merge into one column whose shares are the weighted mean of theirs. Pass how many results each bin's shares are of as `weights`, so a day with two results counts less than a day with fifty.",
          "",
          "**Order and color by category, not by share.** Pass `categories` in a stable order (the annotation config's label order) with stable colors. The evaluators table colors them with `useLabelDistributionColors`: the first label at the bottom in a categorical accent, the rest in the grayscale categorical grays, cycling past the palette's end.",
          "",
          "**Hover for the numbers.** With `renderBinDetail`, hovering a column shows its time span and each category's share and count, and fades the other columns.",
        ].join("\n"),
      },
    },
  },
  tags: ["updated", "incomplete", "unreviewed"],
};

export default meta;
type Story = StoryObj<typeof StackedSparkline>;

/**
 * Two weeks of a yes/no evaluator at the evaluators table's width. A few
 * days are empty and the last two hold nothing. Hover a column for its day,
 * shares and counts.
 */
export const Default: Story = {
  render: () => (
    <div style={{ width: CHART_WIDTH, display: "flex" }}>
      <Columns annotationName="is_correct" fixture={YES_NO} />
    </div>
  ),
};

/**
 * A score row and label rows as the evaluators table stacks them. All three
 * charts get the same width, so their bins share x positions: the empty days
 * line up as gaps in the columns and faint cells in the sparkline's strip.
 */
export const BesideASparkline: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      <Row label="relevance (scores)">
        <Sparkline
          values={YES_NO.values.map((shares) =>
            shares == null ? null : 0.4 + shares[0] * 0.5
          )}
          weights={YES_NO.weights}
          minRange={0.2}
          maxWidth={CHART_WIDTH}
          color="var(--chart-sparkline-stroke-color)"
          coverageColor="var(--chart-sparkline-coverage-fill-color)"
          showCoverage
        />
      </Row>
      <Row label="is_correct (2 labels)">
        <Columns annotationName="is_correct" fixture={YES_NO} />
      </Row>
      <Row label="tone (3 labels)">
        <Columns
          annotationName="tone"
          fixture={{
            ...THREE_LABELS,
            values: THREE_LABELS.values.map((shares, index) =>
              YES_NO.values[index] == null ? null : shares
            ),
          }}
        />
      </Row>
    </Flex>
  ),
};

/**
 * Thirty daily bins at several widths. Each width gets as many columns as it
 * can show at 4px apiece, so narrower charts merge runs of days, weighted by
 * each day's result count.
 */
export const WidthDrivesResolution: Story = {
  render: () => {
    const fixture = createDailyFixture({
      labels: ["correct", "incorrect"],
      seed: 5,
      days: 30,
      emptyTailDays: 0,
    });
    return (
      <Flex direction="column" gap="size-150">
        {[240, 112, 60].map((width) => (
          <Row key={width} label={`${width}px`} width={width}>
            <Columns
              annotationName="is_correct"
              fixture={fixture}
              maxWidth={width}
            />
          </Row>
        ))}
      </Flex>
    );
  },
};

/**
 * Nine labels. Past the accent and the four grays the grays repeat, so no
 * later label takes the first label's color.
 */
export const ManyLabels: Story = {
  render: () => (
    <div style={{ width: CHART_WIDTH, display: "flex" }}>
      <Columns
        annotationName="topic"
        fixture={createDailyFixture({
          labels: [
            "billing",
            "shipping",
            "returns",
            "account",
            "product",
            "warranty",
            "privacy",
            "feedback",
            "other",
          ],
          seed: 9,
        })}
      />
    </div>
  ),
};
