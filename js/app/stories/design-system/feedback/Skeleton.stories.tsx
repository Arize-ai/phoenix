import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import {
  ContentSkeleton,
  Flex,
  ListSkeleton,
  ParagraphSkeleton,
  Skeleton,
  Text,
  TextSkeleton,
} from "@phoenix/components";
import type {
  BorderRadiusValue,
  ComponentSize,
  TextSize,
} from "@phoenix/components/core/types";
import { ExampleDetailsDialogSkeleton } from "@phoenix/pages/example/ExampleDetailsDialog";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A placeholder in the shape of content that is still loading, so the layout
 * does not move when the content arrives. Reach for a prebuilt shape before
 * sizing a `Skeleton` by hand: `TextSkeleton` for one line of text,
 * `ParagraphSkeleton` for several, `ContentSkeleton` for the body of a card,
 * and `ListSkeleton` for a list. A wave sweeps across every skeleton, and
 * stops when the user prefers reduced motion.
 *
 * A line of text is one continuous bar, never a row of word-sized pieces. Put
 * several skeletons on one line only when that line holds separate
 * components, such as three metrics, and space them with the layout the
 * loaded components sit in.
 */
const meta: Meta = {
  title: "Design System/Feedback/Skeleton",
  component: Skeleton,
  subcomponents: {
    TextSkeleton,
    ParagraphSkeleton,
    ContentSkeleton,
    ListSkeleton,
  },
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const RADII: { label: BorderRadiusValue; code: true }[] = (
  ["xsmall", "small", "medium", "large", "full"] as const
).map((radius) => ({ label: radius, code: true }));

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

const LIST_SIZES: { label: ComponentSize; code: true }[] = (
  ["S", "M", "L"] as const
).map((size) => ({ label: size, code: true }));

const LIST_FILL_HEIGHTS: { label: string; code: true; height: number }[] = [
  { label: "160px", code: true, height: 160 },
  { label: "300px", code: true, height: 300 },
];

const LIST_FADE_EDGES: {
  label: string;
  code: true;
  fadeEdge: "bottom" | null;
}[] = [
  { label: "null", code: true, fadeEdge: null },
  { label: "bottom", code: true, fadeEdge: "bottom" },
];

const fullWidthCSS = css`
  width: 100%;
`;

const LINES: { label: string; code: true; lines: number }[] = [
  { label: "1", code: true, lines: 1 },
  { label: "3", code: true, lines: 3 },
  { label: "4", code: true, lines: 4 },
];

export const Default: StoryFn = () => <Skeleton width={200} height={20} />;
Default.tags = ["!dev"];

export const Radii: StoryFn = () => (
  <OptionGrid
    columns={RADII}
    justifyCells="center"
    renderCell={(_row, radius) => (
      <Skeleton width={48} height={48} borderRadius={radius?.label} />
    )}
  />
);
Radii.tags = ["!dev"];
Radii.parameters = { themeLayout: "column" };

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

export const ParagraphSkeletonLineCount: StoryFn = () => (
  <OptionGrid
    rows={LINES}
    cellWidth="200px"
    alignRows="start"
    renderCell={(lines) => <ParagraphSkeleton lines={lines.lines} />}
  />
);
ParagraphSkeletonLineCount.storyName = "Paragraph Skeleton: Line Count";
ParagraphSkeletonLineCount.tags = ["!dev"];
ParagraphSkeletonLineCount.parameters = { themeLayout: "row" };

export const ContentSkeletonDefault: StoryFn = () => (
  <Flex width="300px">
    <ContentSkeleton />
  </Flex>
);
ContentSkeletonDefault.storyName = "Content Skeleton";
ContentSkeletonDefault.tags = ["!dev"];
ContentSkeletonDefault.parameters = { themeLayout: "row" };

/**
 * `ListSkeleton` stands where a list's loaded items will be. Choose the
 * `size` whose height is closest to the loaded items'. Set
 * `itemCount="fill"` when the loaded list fills its container, which must
 * then have a definite height, or be a flex column whose remaining height
 * the skeleton takes. A filling list fades toward the bottom, since the
 * loaded list runs on past it; pass `fadeEdge={null}` to turn that off, or
 * set `fadeEdge` on a counted list that should trail off.
 */
export const ListSkeletonDefault: StoryFn = () => (
  <div css={fullWidthCSS}>
    <ListSkeleton itemCount={3} />
  </div>
);
ListSkeletonDefault.storyName = "List Skeleton";
ListSkeletonDefault.tags = ["!dev"];
ListSkeletonDefault.parameters = { layout: "padded", themeLayout: "column" };

export const ListSkeletonSizes: StoryFn = () => (
  <OptionGrid
    columns={LIST_SIZES}
    cellWidth="240px"
    justifyCells="stretch"
    alignRows="start"
    renderCell={(_row, column) => (
      <div css={fullWidthCSS}>
        <ListSkeleton size={column?.label} itemCount={3} />
      </div>
    )}
  />
);
ListSkeletonSizes.storyName = "List Skeleton: Sizes";
ListSkeletonSizes.tags = ["!dev"];
ListSkeletonSizes.parameters = { layout: "padded", themeLayout: "column" };

export const ListSkeletonFillHeight: StoryFn = () => (
  <OptionGrid
    rows={LIST_FILL_HEIGHTS}
    cellWidth="320px"
    justifyCells="stretch"
    renderCell={(row) => (
      <div
        css={css`
          height: ${row.height}px;
        `}
      >
        <ListSkeleton itemCount="fill" />
      </div>
    )}
  />
);
ListSkeletonFillHeight.storyName = "List Skeleton: Fill Height";
ListSkeletonFillHeight.tags = ["!dev"];
ListSkeletonFillHeight.parameters = {
  layout: "padded",
  themeLayout: "column",
};

export const ListSkeletonFadeEdge: StoryFn = () => (
  <OptionGrid
    columns={LIST_FADE_EDGES}
    cellWidth="320px"
    justifyCells="stretch"
    renderCell={(_row, column) => (
      <div
        css={css`
          height: 240px;
        `}
      >
        <ListSkeleton itemCount="fill" fadeEdge={column?.fadeEdge} />
      </div>
    )}
  />
);
ListSkeletonFadeEdge.storyName = "List Skeleton: Fade Edge";
ListSkeletonFadeEdge.tags = ["!dev"];
ListSkeletonFadeEdge.parameters = { layout: "padded", themeLayout: "column" };

/**
 * A page or panel that is loading shows a skeleton of each of its major
 * layout areas — its panels, cards, headers, toolbars and lists — rather
 * than one spinning `Loading` indicator in place of the whole page. Each
 * skeleton stands where its area will appear, so the reader sees the shape
 * of the page before its content arrives.
 *
 * A skeleton is made of skeleton components, and nothing else. It draws no
 * borders, dividers or separators, no backgrounds or fills, no card frames,
 * and no titles, headings or other text. An area that will be a titled card
 * is one skeleton block; a toolbar is one skeleton bar. Layout that only
 * places the skeletons — padding, gaps, widths — is allowed, because it
 * draws nothing.
 *
 * Prefer to tie each major layout area's skeleton to the data for that
 * area, not to the page as a whole. When the page waits on a single query
 * or a single `Suspense` boundary, nothing renders until the slowest area
 * has finished fetching. Give each area that fetches its own data its own
 * `Suspense` boundary and skeleton instead, so each skeleton is replaced
 * with content as soon as that area's data is available, regardless of the
 * other areas. Keep a lone spinner for content whose shape cannot be known
 * before it loads.
 *
 * The dataset example slide-over shows the composition: one block each for
 * its input, output and metadata cards, and a heading bar and rows for its
 * experiment runs. All of its areas come from one query, so they all appear
 * together.
 */
export const PageSkeletonComposition: StoryFn = () => (
  <div
    css={css`
      width: 100%;
      height: 480px;
    `}
  >
    <ExampleDetailsDialogSkeleton />
  </div>
);
PageSkeletonComposition.storyName = "Page Skeleton Composition";
PageSkeletonComposition.tags = ["!dev"];
PageSkeletonComposition.parameters = {
  layout: "padded",
  themeLayout: "column",
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <Flex direction="column" gap="size-100" width="240px">
    <Skeleton height={80} borderRadius="medium" />
    <Skeleton height={20} width="80%" />
    <Skeleton height={14} width="60%" />
  </Flex>
);
Thumbnail.tags = ["!dev", "!autodocs"];
