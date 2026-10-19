import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import type { CSSProperties } from "react";

import { EdgeFade, Skeleton } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * Fades its content to transparency toward one edge, so a composition
 * appears to trail off beyond its frame. The fade applies to the group as a
 * whole, not to each child, and masks the content rather than painting over
 * it, so it works on any background.
 *
 * The band defaults to three quarters of the element's height. Set
 * `--edge-fade-size` on the element to size it differently. `ListSkeleton`
 * and `TableSkeleton` take the same fade through their `fadeEdge` prop.
 */
const meta: Meta = {
  title: "Design System/Layout/Edge Fade",
  component: EdgeFade,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "padded",
    controls: { disable: true },
  },
};

export default meta;

const FADE_SIZES: { label: string; code?: true; size?: string }[] = [
  { label: "Default" },
  { label: "50%", code: true, size: "50%" },
  {
    label: "--global-dimension-size-300",
    code: true,
    size: "var(--global-dimension-size-300)",
  },
];

export const Default: StoryFn = () => (
  <EdgeFade edge="bottom">
    <Skeleton height={320} width="100%" />
  </EdgeFade>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "column" };

export const FadeSize: StoryFn = () => (
  <OptionGrid
    columns={FADE_SIZES}
    cellWidth="240px"
    justifyCells="stretch"
    alignRows="start"
    renderCell={(_row, column) => (
      <EdgeFade
        edge="bottom"
        style={
          column?.size
            ? ({ "--edge-fade-size": column.size } as CSSProperties)
            : undefined
        }
      >
        <Skeleton height={240} width="100%" />
      </EdgeFade>
    )}
  />
);
FadeSize.storyName = "Fade Size";
FadeSize.tags = ["!dev"];
FadeSize.parameters = { themeLayout: "column" };

export const Thumbnail: StoryFn = () => (
  <EdgeFade
    edge="bottom"
    css={css`
      width: 240px;
    `}
  >
    <Skeleton height={180} width="100%" />
  </EdgeFade>
);
Thumbnail.tags = ["!dev", "!autodocs"];
