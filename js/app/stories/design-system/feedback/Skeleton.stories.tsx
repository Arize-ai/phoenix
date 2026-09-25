import type { Meta, StoryFn } from "@storybook/react";

import {
  ContentSkeleton,
  Flex,
  ParagraphSkeleton,
  Skeleton,
  Text,
  TextSkeleton,
} from "@phoenix/components";
import type {
  AnimationType,
  SkeletonProps,
} from "@phoenix/components/core/loading/Skeleton";
import type { TextSize } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A placeholder in the shape of content that is still loading, so the layout
 * does not move when the content arrives. Reach for a prebuilt shape before
 * sizing a `Skeleton` by hand: `TextSkeleton` for one line of text,
 * `ParagraphSkeleton` for several, and `ContentSkeleton` for the body of a
 * card.
 */
const meta: Meta = {
  title: "Design System/Feedback/Skeleton",
  component: Skeleton,
  subcomponents: { TextSkeleton, ParagraphSkeleton, ContentSkeleton },
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const RADII: {
  label: string;
  code: true;
  value: SkeletonProps["borderRadius"];
}[] = [
  { label: "none", code: true, value: "none" },
  { label: "XS", code: true, value: "XS" },
  { label: "S", code: true, value: "S" },
  { label: "M", code: true, value: "M" },
  { label: "L", code: true, value: "L" },
  { label: "circle", code: true, value: "circle" },
];

const ANIMATIONS: { label: string; code: true; value: AnimationType }[] = [
  { label: "pulse", code: true, value: "pulse" },
  { label: "wave", code: true, value: "wave" },
  { label: "false", code: true, value: false },
];

const TEXT_SIZES: { label: TextSize; code: true }[] = (
  ["XS", "S", "M", "L", "XL", "XXL"] as const
).map((size) => ({ label: size, code: true }));

const TEXT_COLUMNS: {
  label: string;
  fontFamily: "default" | "mono";
  isSkeleton: boolean;
}[] = [
  { label: "Text", fontFamily: "default", isSkeleton: false },
  { label: "Skeleton", fontFamily: "default", isSkeleton: true },
  { label: "Mono text", fontFamily: "mono", isSkeleton: false },
  { label: "Mono skeleton", fontFamily: "mono", isSkeleton: true },
];

const TEXT = "Latency";

const LINES: { label: string; code: true; lines: number }[] = [
  { label: "1", code: true, lines: 1 },
  { label: "3", code: true, lines: 3 },
  { label: "5", code: true, lines: 5 },
];

const GAPS: { label: string; code: true; gap: number }[] = [
  { label: "4", code: true, gap: 4 },
  { label: "8", code: true, gap: 8 },
  { label: "16", code: true, gap: 16 },
];

export const Default: StoryFn = () => <Skeleton width={200} height={20} />;
Default.tags = ["!dev"];

export const Radii: StoryFn = () => (
  <OptionGrid
    columns={RADII}
    justifyCells="center"
    renderCell={(_row, radius) => (
      <Skeleton width={48} height={48} borderRadius={radius?.value} />
    )}
  />
);
Radii.tags = ["!dev"];
Radii.parameters = { themeLayout: "column" };

export const Animations: StoryFn = () => (
  <OptionGrid
    rows={ANIMATIONS}
    renderCell={(animation) => (
      <Skeleton width={200} height={20} animation={animation.value} />
    )}
  />
);
Animations.tags = ["!dev"];
Animations.parameters = { themeLayout: "row" };

/**
 * `TextSkeleton` takes the line height of the text size it stands in for, and
 * measures a width given in `ch` in that text's font, so a row of skeletons is
 * the size of the text that replaces it.
 */
export const TextSkeletonSizes: StoryFn = () => (
  <OptionGrid
    rows={TEXT_SIZES}
    columns={TEXT_COLUMNS}
    alignRows="start"
    renderCell={(size, column) =>
      column?.isSkeleton ? (
        <TextSkeleton
          size={size.label}
          width={`${TEXT.length}ch`}
          fontFamily={column.fontFamily}
        />
      ) : (
        <Text size={size.label} fontFamily={column?.fontFamily}>
          {TEXT}
        </Text>
      )
    }
  />
);
TextSkeletonSizes.storyName = "Text Skeleton: Sizes";
TextSkeletonSizes.tags = ["!dev"];
TextSkeletonSizes.parameters = { themeLayout: "column" };

export const ParagraphSkeletonLinesAndGaps: StoryFn = () => (
  <OptionGrid
    rows={LINES}
    columns={GAPS}
    cellWidth="200px"
    alignRows="start"
    renderCell={(lines, gap) => (
      <ParagraphSkeleton lines={lines.lines} gap={gap?.gap} />
    )}
  />
);
ParagraphSkeletonLinesAndGaps.storyName = "Paragraph Skeleton: Lines and Gaps";
ParagraphSkeletonLinesAndGaps.tags = ["!dev"];
ParagraphSkeletonLinesAndGaps.parameters = { themeLayout: "column" };

export const ContentSkeletonDefault: StoryFn = () => (
  <Flex width="300px">
    <ContentSkeleton />
  </Flex>
);
ContentSkeletonDefault.storyName = "Content Skeleton";
ContentSkeletonDefault.tags = ["!dev"];
ContentSkeletonDefault.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <Flex direction="column" gap="size-100" width="240px">
    <Skeleton height={80} borderRadius={8} />
    <Skeleton height={20} width="80%" />
    <Skeleton height={14} width="60%" />
  </Flex>
);
Thumbnail.tags = ["!dev", "!autodocs"];
