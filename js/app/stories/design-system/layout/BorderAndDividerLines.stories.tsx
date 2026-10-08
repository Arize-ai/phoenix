import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { DividerSize, DividerVariant } from "@phoenix/components";
import { Divider, fadedDividerBottomCSS, Flex } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Layout/Border and divider lines",
  component: Divider,
  tags: ["updated", "incomplete", "unreviewed"],
  parameters: {
    layout: "centered",
    themeLayout: "column",
  },
};

export default meta;

const tokenBoxCSS = css`
  padding: var(--global-dimension-size-200);
  background: var(--global-background-color-default);
  min-width: 80px;
  text-align: center;
  font-size: var(--global-dimension-font-size-75);
`;

const dividerFrameCSS = css`
  padding: var(--global-dimension-size-100);
  border: 1px dashed var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  font-size: var(--global-dimension-font-size-75);
`;

export const BorderVsDivider: StoryFn = () => (
  <Flex direction="row" gap="size-400" wrap justifyContent="center">
    <div
      css={css`
        ${tokenBoxCSS}
        border: 1px solid var(--global-border-color-default);
      `}
    >
      <div>Border</div>
    </div>
    <div>
      Divider
      <Divider size="sm" />
      Separates
    </div>
  </Flex>
);
BorderVsDivider.parameters = { themeLayout: "row" };
BorderVsDivider.tags = ["!dev"];

const borderSizes = [
  { label: "thin", code: true },
  { label: "thick", code: true },
] as const;

export const BorderSizes: StoryFn = () => (
  <OptionGrid
    columns={borderSizes}
    justifyCells="center"
    renderCell={(_, column) => (
      <div
        css={css`
          ${tokenBoxCSS}
          border: var(--global-border-size-${column?.label}) solid
            var(--global-border-color-default);
        `}
      />
    )}
  />
);
BorderSizes.parameters = { themeLayout: "row" };
BorderSizes.tags = ["!dev"];

const roundings = [
  { label: "xsmall", code: true },
  { label: "small", code: true },
  { label: "medium", code: true },
  { label: "large", code: true },
  { label: "full", code: true },
] as const;

export const BorderRounding: StoryFn = () => (
  <OptionGrid
    columns={roundings}
    justifyCells="center"
    renderCell={(_, column) => (
      <div
        css={css`
          ${tokenBoxCSS}
          border: 1px solid var(--global-border-color-default);
          border-radius: var(--global-rounding-${column?.label});
        `}
      />
    )}
  />
);
BorderRounding.tags = ["!dev"];

const dividerVariants: readonly {
  label: DividerVariant;
  code: true;
}[] = [
  { label: "solid", code: true },
  { label: "fading", code: true },
];

const dividerSizes: readonly {
  label: string;
  code?: boolean;
  size?: DividerSize;
}[] = [
  { label: "No size" },
  { label: "xs", code: true, size: "xs" },
  { label: "sm", code: true, size: "sm" },
  { label: "md", code: true, size: "md" },
];

export const DividerVariantsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={dividerVariants}
    columns={dividerSizes}
    cellWidth="160px"
    renderCell={(row, column) => (
      <div css={dividerFrameCSS}>
        Above
        <Divider variant={row.label} size={column?.size} />
        Below
      </div>
    )}
  />
);
DividerVariantsAndSizes.tags = ["!dev"];

const orientations = [
  { label: "horizontal", code: true },
  { label: "vertical", code: true },
] as const;

export const DividerVariantsAndOrientations: StoryFn = () => (
  <OptionGrid
    rows={dividerVariants}
    columns={orientations}
    cellWidth="200px"
    renderCell={(row, column) =>
      column?.label === "vertical" ? (
        <div
          css={css`
            ${dividerFrameCSS}
            display: flex;
            align-items: center;
            height: 80px;
          `}
        >
          Before
          <Divider variant={row.label} orientation="vertical" size="sm" />
          After
        </div>
      ) : (
        <div css={dividerFrameCSS}>
          Above
          <Divider variant={row.label} size="sm" />
          Below
        </div>
      )
    }
  />
);
DividerVariantsAndOrientations.tags = ["!dev"];

const fadeWidths = [
  { label: "300px", code: true, width: 300 },
  { label: "420px", code: true, width: 420 },
  { label: "800px", code: true, width: 800 },
] as const;

export const FadeWidths: StoryFn = () => (
  <OptionGrid
    rows={fadeWidths}
    renderCell={(row) => (
      <div
        css={css`
          ${fadedDividerBottomCSS}
          width: ${row.width}px;
          height: var(--global-dimension-size-400);
          border-left: 1px dashed var(--global-border-color-default);
          border-right: 1px dashed var(--global-border-color-default);
        `}
      />
    )}
  />
);
FadeWidths.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: BorderVsDivider,
};
