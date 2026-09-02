import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  Sparkline,
  type SparklineBinRange,
  type SparklineProps,
} from "@phoenix/components/chart";

const LINE_COLOR = "var(--global-text-color-700)";

/** Hours per bin in the fixtures, so tooltips can name a bin's span. */
const HOURS_PER_BIN = 1;

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
  values: (number | null)[];
  weights: number[];
};

/**
 * Five days of hourly mean scores the way an evaluator produces them: a
 * score that drifts and jitters, hours with no evaluations (null), a few
 * evaluations behind most hours and a burst behind some, and a tail of empty
 * hours because the evaluator has not run for the last day.
 */
function createHourlyFixture({
  seed,
  hours = 120,
  emptyTailHours = 24,
  gapRate = 0.15,
}: {
  seed: number;
  hours?: number;
  emptyTailHours?: number;
  gapRate?: number;
}): Fixture {
  const random = createRandom(seed);
  const values: (number | null)[] = [];
  const weights: number[] = [];
  let level = 0.65;
  for (let hour = 0; hour < hours; hour++) {
    level = Math.min(0.95, Math.max(0.2, level + (random() - 0.5) * 0.08));
    const isEmpty = hour >= hours - emptyTailHours || random() < gapRate;
    if (isEmpty) {
      values.push(null);
      weights.push(0);
      continue;
    }
    values.push(Math.min(1, Math.max(0, level + (random() - 0.5) * 0.3)));
    // Most hours see a handful of evaluations; a few see a burst
    weights.push(
      random() < 0.1
        ? 20 + Math.floor(random() * 30)
        : 1 + Math.floor(random() * 5)
    );
  }
  return { values, weights };
}

const FIXTURE = createHourlyFixture({ seed: 7 });

/** Describes a drawn point for the tooltip: its hours, mean, and sample count. */
function describeRange(
  { values, weights }: Fixture,
  { start, end }: SparklineBinRange
): ReactNode {
  let weightedSum = 0;
  let count = 0;
  for (let index = start; index <= end; index++) {
    const value = values[index];
    if (value == null) {
      continue;
    }
    weightedSum += value * weights[index];
    count += weights[index];
  }
  const hoursLabel =
    start === end
      ? `hour ${start * HOURS_PER_BIN}`
      : `hours ${start * HOURS_PER_BIN}–${(end + 1) * HOURS_PER_BIN}`;
  return (
    <Text size="S">
      {hoursLabel} · μ {(weightedSum / count).toFixed(2)} · n={count}
    </Text>
  );
}

/** A labeled row: a caption beside a sparkline held at a fixed width. */
function Row({
  label,
  width,
  children,
}: {
  label: ReactNode;
  width: number;
  children: ReactNode;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-200">
      <div style={{ width: 260, flex: "none" }}>
        <Text size="S" color="text-700">
          {label}
        </Text>
      </div>
      <div style={{ width, flex: "none", display: "flex" }}>{children}</div>
    </Flex>
  );
}

const meta: Meta<typeof Sparkline> = {
  title: "Charting/Sparkline",
  component: Sparkline,
  parameters: {
    inset: true,
    docs: {
      description: {
        component: [
          "A single-series line for table cells and stat tiles. It stretches to the width its flex container gives it, up to `maxWidth`, and every bin in `values` keeps its own x position whether or not it holds a value, so sparklines that share a time axis align across rows and a series that stops early visibly stops short.",
          "",
          "**A drawn point is one bin or a range of bins.** The component measures its rendered width and allows one point per 4px. When there are more bins than that, adjacent bins are merged in equal-length runs into a single point placed over the center of the bins it covers. So the same 120 hourly bins draw as 120 points at 480px, 40 three-hour points at 160px, and 20 six-hour points at 80px. `renderPointDetail` receives the inclusive range of source bins behind the hovered point, which is a single index unless merging happened.",
          "",
          "**`weights` make merged points honest.** Each bin's value is a mean over some number of samples. Merging bins by averaging their means would let an hour with one evaluation count as much as an hour with fifty. Passing the sample count per bin as `weights` makes a merged point the weighted mean, which is the mean you would get by pooling the samples. Empty bins contribute nothing regardless of weight.",
          "",
          "**`minRange` keeps small drift looking small.** The vertical axis fits the data by default, so a score wandering between 0.60 and 0.66 would be stretched across the full height and read as volatile. `minRange` is the least value range the axis spans, centered on the data; pass a fraction of the score's possible range so a nearly flat series looks nearly flat while wide swings still fill the height.",
          "",
          "Gaps: the line breaks at an empty point. A gap of exactly one point is bridged at reduced opacity so a momentary lapse does not shatter the trend. An isolated value draws as a dot of the line's weight, and the most recent value is always marked.",
        ].join("\n"),
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

/**
 * Five days of hourly mean scores at the width the evaluators table gives a
 * sparkline. 120 bins in 160px merge into 40 three-hour points. The last day
 * holds no evaluations, so the line stops short of the right edge and the
 * end dot marks the most recent value. Hover for the hours, mean, and sample
 * count behind each point.
 */
export const Default: Story = {
  render: () => (
    <div style={{ width: 160, display: "flex" }}>
      <Sparkline
        values={FIXTURE.values}
        weights={FIXTURE.weights}
        minRange={0.2}
        maxWidth={160}
        color={LINE_COLOR}
        aria-label="Mean score over the last 5 days"
        renderPointDetail={(range) => describeRange(FIXTURE, range)}
      />
    </div>
  ),
};

/**
 * The same 120 hourly bins at several widths. Each width gets as many points
 * as it can show at 4px apiece, so a point covers one hour at 480px and up,
 * three hours at 160px, and eight hours at 60px. Hover any point to see the
 * range of hours behind it. The shape stays legible at every size instead of
 * collapsing into a dense scribble. In a table cell, pass `maxWidth` so a
 * wide column does not stretch the sparkline into an axis-less chart.
 */
export const WidthDrivesResolution: Story = {
  render: () => (
    <Flex direction="column" gap="size-150">
      {[480, 240, 160, 100, 60].map((width) => {
        const points = Math.min(FIXTURE.values.length, Math.floor(width / 4));
        const hoursPerPoint = Math.ceil(FIXTURE.values.length / points);
        return (
          <Row
            key={width}
            width={width}
            label={`${width}px · ${Math.ceil(FIXTURE.values.length / hoursPerPoint)} points · ${hoursPerPoint}h each`}
          >
            <Sparkline
              values={FIXTURE.values}
              weights={FIXTURE.weights}
              minRange={0.2}
              color={LINE_COLOR}
              renderPointDetail={(range) => describeRange(FIXTURE, range)}
            />
          </Row>
        );
      })}
    </Flex>
  ),
};

/**
 * Why weights matter. Both rows draw the same 48 hourly values in 64px, so
 * every point merges three hours. In each hour the score is either 0.9 on a
 * single evaluation or 0.3 on twenty, arranged so the heavy hours are low
 * early and high late. Without weights each merged point is the plain mean
 * of its hours, wobbling between 0.5 and 0.7 the whole way, and the line
 * reads as flat. With the sample counts as weights the merged points follow
 * the evaluations that actually happened and step from about 0.3 to about
 * 0.9 halfway through. Hover to compare the means and sample counts.
 */
export const WeightsShapeMergedPoints: Story = {
  render: () => {
    const hours = 48;
    const values: number[] = [];
    const weights: number[] = [];
    for (let hour = 0; hour < hours; hour++) {
      const isHeavy = hour % 2 === 0;
      const heavyIsLow = hour < hours / 2;
      const isLow = isHeavy ? heavyIsLow : !heavyIsLow;
      values.push(isLow ? 0.3 : 0.9);
      weights.push(isHeavy ? 20 : 1);
    }
    const equalWeights = weights.map(() => 1);
    return (
      <Flex direction="column" gap="size-150">
        <Row width={64} label="Equal weights: every hour counts once">
          <Sparkline
            values={values}
            minRange={1}
            color={LINE_COLOR}
            renderPointDetail={(range) =>
              describeRange({ values, weights: equalWeights }, range)
            }
          />
        </Row>
        <Row
          width={64}
          label="Sample counts as weights: hours with more evaluations pull harder"
        >
          <Sparkline
            values={values}
            weights={weights}
            minRange={1}
            color={LINE_COLOR}
            renderPointDetail={(range) =>
              describeRange({ values, weights }, range)
            }
          />
        </Row>
      </Flex>
    );
  },
};

/**
 * A score drifting between 0.60 and 0.66 over 40 bins. Fitting the axis to
 * the data alone turns six hundredths into cliffs. With `minRange` set to a
 * fifth of the 0–1 score range the drift takes up a third of the height and
 * reads as the small movement it is; a `minRange` of the full range flattens
 * it almost entirely. The evaluators table uses a fifth of the annotation's
 * configured bounds.
 */
export const MinRangeCalmsSmallDrift: Story = {
  render: () => {
    const random = createRandom(3);
    const values = Array.from(
      { length: 40 },
      () => 0.6 + Math.round(random() * 6) / 100
    );
    return (
      <Flex direction="column" gap="size-150">
        {[
          {
            minRange: undefined,
            label:
              "No minRange: the axis fits the data, 0.60–0.66 fills the height",
          },
          {
            minRange: 0.2,
            label:
              "minRange 0.2: the axis spans at least a fifth of a 0–1 score",
          },
          {
            minRange: 1,
            label: "minRange 1: the axis spans the whole 0–1 score",
          },
        ].map(({ minRange, label }) => (
          <Row key={label} width={160} label={label}>
            <Sparkline values={values} minRange={minRange} color={LINE_COLOR} />
          </Row>
        ))}
      </Flex>
    );
  },
};

/**
 * How empty bins render, on a shared 12-bin axis so the rows line up. A gap
 * of one bin is bridged faintly; a wider gap breaks the line; a value with
 * empty neighbors is a dot; a series that ends early stops short with its
 * last value marked; a series with one value is a single dot in its bin.
 */
export const GapsAndEnds: Story = {
  render: () => {
    const rows: Array<{ label: string; values: (number | null)[] }> = [
      {
        label: "One empty bin: bridged at reduced opacity",
        values: [
          0.5,
          0.6,
          0.7,
          0.65,
          null,
          0.7,
          0.75,
          0.7,
          0.8,
          0.85,
          0.8,
          0.9,
        ],
      },
      {
        label: "Two or more empty bins: the line breaks",
        values: [
          0.5,
          0.6,
          0.7,
          0.65,
          null,
          null,
          null,
          0.7,
          0.8,
          0.85,
          0.8,
          0.9,
        ],
      },
      {
        label: "Isolated values draw as dots",
        values: [
          0.5,
          null,
          null,
          0.6,
          null,
          null,
          0.7,
          0.75,
          0.7,
          null,
          null,
          0.9,
        ],
      },
      {
        label: "A series that stopped early keeps its axis and marks its end",
        values: [
          0.5,
          0.6,
          0.7,
          0.65,
          0.7,
          0.75,
          0.7,
          null,
          null,
          null,
          null,
          null,
        ],
      },
      {
        label: "A single value",
        values: [
          null,
          null,
          null,
          null,
          null,
          0.6,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ];
    return (
      <Flex direction="column" gap="size-150">
        {rows.map(({ label, values }) => (
          <Row key={label} width={160} label={label}>
            <Sparkline values={values} minRange={0.2} color={LINE_COLOR} />
          </Row>
        ))}
      </Flex>
    );
  },
};

/**
 * `renderPointDetail` receives the inclusive range of source bins behind the
 * hovered point. At 480px every hourly bin is its own point and the range is
 * a single index; at 96px each point covers five hours and the range spans
 * them, so the detail can show the merged span and the pooled sample count.
 */
export const PointDetailRanges: Story = {
  render: () => {
    const renderPointDetail = (range: SparklineBinRange) =>
      describeRange(FIXTURE, range);
    const props: Omit<SparklineProps, "renderPointDetail"> = {
      values: FIXTURE.values,
      weights: FIXTURE.weights,
      minRange: 0.2,
      color: LINE_COLOR,
    };
    return (
      <Flex direction="column" gap="size-150">
        <Row width={480} label="480px: one hour per point">
          <Sparkline {...props} renderPointDetail={renderPointDetail} />
        </Row>
        <Row width={96} label="96px: five hours per point">
          <Sparkline {...props} renderPointDetail={renderPointDetail} />
        </Row>
      </Flex>
    );
  },
};
