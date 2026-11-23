import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { OverflowRow, Token, View } from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A single line of items that hides whatever does not fit behind a `+N`
 * badge, which opens the hidden items in a popover. When not even the first
 * item fits, every item goes behind the badge rather than one showing cut
 * off. With `isExpanded` the row wraps onto as many lines as it needs
 * instead.
 */
const meta: Meta = {
  title: "Design System/Layout/Overflow Row",
  tags: ["updated", "unreviewed", "incomplete"],
  component: OverflowRow,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const LABELS = [
  "correctness",
  "hallucination",
  "toxicity",
  "relevance",
  "conciseness",
  "helpfulness",
  "coherence",
  "groundedness",
];

const COLORS = [
  "var(--global-color-celery-600)",
  "var(--global-color-fuchsia-600)",
  "var(--global-color-indigo-600)",
  "var(--global-color-magenta-600)",
  "var(--global-color-seafoam-600)",
  "var(--global-color-yellow-600)",
  "var(--global-color-purple-600)",
  "var(--global-color-chartreuse-600)",
];

const Tokens = ({
  count = LABELS.length,
  boxless = false,
  size = "M",
}: {
  count?: number;
  boxless?: boolean;
  size?: "S" | "M";
}) => (
  <>
    {LABELS.slice(0, count).map((label, index) => {
      const Wrapper = boxless ? StopPropagation : Fragment;
      return (
        <Wrapper key={label}>
          <Token color={COLORS[index % COLORS.length]} size={size}>
            {label}
          </Token>
        </Wrapper>
      );
    })}
  </>
);

const Frame = ({ width, children }: { width: number; children: ReactNode }) => (
  <View
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
    padding="size-100"
    width={`${width}px`}
  >
    {children}
  </View>
);

export const Default: StoryFn = () => (
  <Frame width={320}>
    <OverflowRow>
      <Tokens />
    </OverflowRow>
  </Frame>
);
Default.tags = ["!dev"];

const FITS = [
  { label: "Fits", width: 320, count: 3 },
  { label: "Overflows", width: 320, count: LABELS.length },
  { label: "Room for one item", width: 160, count: LABELS.length },
  { label: "Narrower than one item", width: 80, count: LABELS.length },
];

const EXPANSION = [
  { label: "Collapsed", code: false, isExpanded: false },
  { label: "isExpanded", code: true, isExpanded: true },
];

export const Widths: StoryFn = () => (
  <OptionGrid
    rows={FITS}
    columns={EXPANSION}
    alignRows="start"
    renderCell={(row, column) => (
      <Frame width={row.width}>
        <OverflowRow isExpanded={column?.isExpanded}>
          <Tokens count={row.count} />
        </OverflowRow>
      </Frame>
    )}
  />
);
Widths.tags = ["!dev"];
Widths.parameters = { themeLayout: "column" };

const SIZES = [
  { label: "M", code: true, size: "M" },
  { label: "S", code: true, size: "S" },
] as const;

/**
 * The "+N" badge takes the size of the items it follows, and the row
 * reserves only the room that badge needs.
 */
export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    renderCell={(row) => (
      <Frame width={320}>
        <OverflowRow size={row.size}>
          <Tokens size={row.size} />
        </OverflowRow>
      </Frame>
    )}
  />
);
Sizes.tags = ["!dev"];

/**
 * Items may sit behind wrappers that lay out no box of their own, such as the
 * event guard around each annotation pill. The row measures the items through
 * them and clamps the same way.
 */
export const WrappedItems: StoryFn = () => (
  <Frame width={320}>
    <OverflowRow>
      <Tokens boxless />
    </OverflowRow>
  </Frame>
);
WrappedItems.storyName = "Wrapped Items";
WrappedItems.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Frame width={288}>
      <OverflowRow>
        <Tokens />
      </OverflowRow>
    </Frame>
  ),
};
