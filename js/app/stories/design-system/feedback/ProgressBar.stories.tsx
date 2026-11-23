import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import { ProgressBar } from "@phoenix/components";
import { useWordColor } from "@phoenix/hooks/useWordColor";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A linear, determinate progress indicator: a download's progress, or an
 * annotation's mean score as a share of its range.
 *
 * `isIndeterminate` has no styling: the bar draws a full fill, the same as
 * `100`, so an operation of unknown length needs a `ProgressCircle` instead.
 *
 * Set `--mod-barloader-fill-color` (and `--mod-barloader-track-color` for the
 * track) to color a bar by what it measures, as experiment annotation scores
 * do with the annotation's color.
 */
const meta: Meta = {
  title: "Design System/Feedback/Progress Bar",
  component: ProgressBar,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const VALUES: { label: string; code: true; value?: number }[] = [
  { label: "0", code: true, value: 0 },
  { label: "25", code: true, value: 25 },
  { label: "60", code: true, value: 60 },
  { label: "100", code: true, value: 100 },
  { label: "isIndeterminate", code: true },
];

const SIZES: {
  label: string;
  code?: boolean;
  width?: string;
  height?: string;
}[] = [
  { label: "Default" },
  { label: "40px", code: true, width: "40px" },
  {
    label: "100% · size-50",
    code: true,
    width: "100%",
    height: "var(--global-dimension-size-50)",
  },
];

export const Default: StoryFn = () => (
  <ProgressBar value={60} aria-label="Model download progress" />
);
Default.tags = ["!dev"];

export const Values: StoryFn = () => (
  <OptionGrid
    rows={VALUES}
    renderCell={(row) => (
      <ProgressBar
        value={row.value}
        isIndeterminate={row.value === undefined}
        aria-label="Progress"
      />
    )}
  />
);
Values.tags = ["!dev"];
Values.parameters = { themeLayout: "row" };

export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    cellWidth="240px"
    renderCell={(size) => (
      <ProgressBar
        value={60}
        width={size.width}
        height={size.height}
        aria-label="Progress"
      />
    )}
  />
);
Sizes.tags = ["!dev"];
Sizes.parameters = { themeLayout: "row" };

function AnnotationScoreBar({ name, value }: { name: string; value: number }) {
  const annotationColor = useWordColor(name);
  return (
    <ProgressBar
      css={css`
        --mod-barloader-fill-color: ${annotationColor};
      `}
      value={value}
      width="100%"
      height="var(--global-dimension-size-50)"
      aria-label={`${name} average score`}
    />
  );
}

const ANNOTATIONS = [
  { label: "correctness", code: true, value: 82 },
  { label: "hallucination", code: true, value: 14 },
  { label: "helpfulness", code: true, value: 57 },
] as const;

export const FillColor: StoryFn = () => (
  <OptionGrid
    rows={ANNOTATIONS}
    cellWidth="240px"
    renderCell={(annotation) => (
      <AnnotationScoreBar name={annotation.label} value={annotation.value} />
    )}
  />
);
FillColor.tags = ["!dev"];
FillColor.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <ProgressBar value={60} width="240px" aria-label="Progress" />
);
Thumbnail.tags = ["!dev", "!autodocs"];
