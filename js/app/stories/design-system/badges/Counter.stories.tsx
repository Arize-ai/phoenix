import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Button, Counter, MarkerTrigger } from "@phoenix/components";
import type {
  CounterNotation,
  CounterVariant,
} from "@phoenix/components/core/counter";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A Count: how many of something the parent holds, set beside the label it
 * counts, such as a tab, a navigation item or a filter button. Round, because
 * it is a property of its parent. Numerals are tabular, so counts in a column
 * line up.
 *
 * - **neutral**: a count the reader should notice
 * - **quiet**: a count that recedes into dense chrome, such as the side
 *   navigation
 * - **danger**: only when the count itself is the alarm, such as a span's
 *   exceptions
 *
 * The parent's accessible name picks the count up on its own ("Labels (3)"),
 * always as the full number even when `max` or `compact` shortens what is
 * shown. A parent with its own `aria-label` overrides its content, so that
 * label must include the count. `count={null}` renders a
 * placeholder while the count is loading or unknown. `max` caps the shown
 * count (`99+`), `showZero={false}` hides a zero for notification counts
 * that should disappear when there is nothing to notice, and `compact`
 * notation abbreviates large counts.
 *
 * A Counter is never its own hit target. Inside a `MarkerTrigger` it shows
 * the trigger's hover and pressed state, which a static grid cannot hold.
 * Inside any other control, the control draws its own state and the Counter
 * does not change.
 */
const meta: Meta = {
  title: "Design System/Badges/Counter",
  component: Counter,
  subcomponents: { MarkerTrigger },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const VARIANTS: { label: CounterVariant; code: true }[] = [
  { label: "neutral", code: true },
  { label: "quiet", code: true },
  { label: "danger", code: true },
];

const COUNTS: { label: string; count: number | null }[] = [
  { label: "Unknown", count: null },
  { label: "Zero", count: 0 },
  { label: "1 digit", count: 7 },
  { label: "3 digits", count: 128 },
  { label: "7 digits", count: 1048576 },
];

const MAXES: { label: string; code?: true; max?: number }[] = [
  { label: "No max" },
  { label: "99", code: true, max: 99 },
];

const MAX_COUNTS: { label: string; code: true; count: number }[] = [
  { label: "42", code: true, count: 42 },
  { label: "99", code: true, count: 99 },
  { label: "100", code: true, count: 100 },
  { label: "1000", code: true, count: 1000 },
];

const NOTATIONS: { label: CounterNotation; code: true }[] = [
  { label: "standard", code: true },
  { label: "compact", code: true },
];

const NOTATION_COUNTS: { label: string; code: true; count: number }[] = [
  { label: "950", code: true, count: 950 },
  { label: "1234", code: true, count: 1234 },
  { label: "56789", code: true, count: 56789 },
  { label: "1048576", code: true, count: 1048576 },
];

const SHOW_ZERO: { label: string; code: true; showZero: boolean }[] = [
  { label: "true", code: true, showZero: true },
  { label: "false", code: true, showZero: false },
];

const ZERO_COUNTS: { label: string; code: true; count: number }[] = [
  { label: "0", code: true, count: 0 },
  { label: "3", code: true, count: 3 },
];

const TRIGGER_STATES: { label: string; isDisabled: boolean }[] = [
  { label: "Enabled", isDisabled: false },
  { label: "Disabled", isDisabled: true },
];

export const Default: StoryFn = () => <Counter count={12} />;
Default.tags = ["!dev"];

export const VariantsAndCounts: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={COUNTS}
    renderCell={(variant, count) => (
      <Counter count={count?.count ?? null} variant={variant.label} />
    )}
  />
);
VariantsAndCounts.tags = ["!dev"];
VariantsAndCounts.parameters = { themeLayout: "column" };

export const MaxAndCounts: StoryFn = () => (
  <OptionGrid
    rows={MAXES}
    columns={MAX_COUNTS}
    renderCell={(max, count) => (
      <Counter count={count?.count ?? null} max={max.max} />
    )}
  />
);
MaxAndCounts.tags = ["!dev"];
MaxAndCounts.parameters = { themeLayout: "column" };

export const NotationAndCounts: StoryFn = () => (
  <OptionGrid
    rows={NOTATIONS}
    columns={NOTATION_COUNTS}
    renderCell={(notation, count) => (
      <Counter count={count?.count ?? null} notation={notation.label} />
    )}
  />
);
NotationAndCounts.tags = ["!dev"];
NotationAndCounts.parameters = { themeLayout: "column" };

export const ShowZero: StoryFn = () => (
  <OptionGrid
    rows={SHOW_ZERO}
    columns={ZERO_COUNTS}
    renderCell={(showZero, count) => (
      <Counter count={count?.count ?? null} showZero={showZero.showZero} />
    )}
  />
);
ShowZero.tags = ["!dev"];
ShowZero.parameters = { themeLayout: "row" };

export const InAButton: StoryFn = () => (
  <Button size="S" onPress={fn()}>
    Labels <Counter count={3} />
  </Button>
);
InAButton.tags = ["!dev"];

export const InATrigger: StoryFn = () => (
  <OptionGrid
    rows={TRIGGER_STATES}
    renderCell={(state) => (
      <MarkerTrigger
        aria-label="Exceptions, 3"
        isDisabled={state.isDisabled}
        onPress={fn()}
      >
        <Counter count={3} variant="danger" />
      </MarkerTrigger>
    )}
  />
);
InATrigger.tags = ["!dev"];
InATrigger.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Counter count={9} />
      <Counter count={12000} max={999} />
      <Counter count={3} variant="danger" />
      <Counter count={1234} notation="compact" variant="quiet" />
    </div>
  ),
};
