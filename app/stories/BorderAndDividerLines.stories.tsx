import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import {
  Divider,
  fadedDividerBottomCSS,
  fadedDividerLeftCSS,
  fadedDividerRightCSS,
  fadedDividerTopCSS,
  Flex,
} from "@phoenix/components";

const meta: Meta = {
  title: "Reference/Border and divider lines",
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

const labelCSS = css`
  color: var(--global-text-color-secondary);
  margin-top: var(--global-dimension-size-100);
`;

/** Border color tokens. Docs only. */
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

/** Border size tokens. Docs only. */
export const BorderSizes: StoryFn = () => (
  <Flex direction="row" gap="size-400" wrap justifyContent="center">
    <div
      css={css`
        ${tokenBoxCSS}
        border: var(--global-border-size-thin) solid
          var(--global-border-color-default);
      `}
    >
      <div>thin</div>
      <div css={labelCSS}>1px</div>
    </div>
    <div
      css={css`
        ${tokenBoxCSS}
        border: var(--global-border-size-thick) solid
          var(--global-border-color-default);
      `}
    >
      <div>thick</div>
      <div css={labelCSS}>2px</div>
    </div>
  </Flex>
);
BorderSizes.parameters = { themeLayout: "row" };
BorderSizes.tags = ["!dev"];

/** Rounding tokens (border-radius). Docs only. */
export const BorderRounding: StoryFn = () => (
  <Flex
    direction="row"
    gap="size-400"
    wrap
    alignItems="start"
    justifyContent="center"
  >
    {(
      [
        ["xsmall", "2px"],
        ["small", "4px"],
        ["medium", "8px"],
        ["large", "16px"],
        ["full", "9999px"],
      ] as const
    ).map(([name, value]) => (
      <div
        key={name}
        css={css`
          ${tokenBoxCSS}
          border: 1px solid var(--global-border-color-default);
          border-radius: var(--global-rounding-${name});
        `}
      >
        <div>{name}</div>
        <div css={labelCSS}>{value}</div>
      </div>
    ))}
  </Flex>
);
BorderRounding.tags = ["!dev"];

const hBoxCSS = (
  dividerCSS: ReturnType<typeof css>,
  width: number | string
) => css`
  ${dividerCSS}
  width: ${typeof width === "number" ? `${width}px` : width};
  height: var(--global-dimension-size-400);
  background: var(--global-background-color-default);
  margin-bottom: var(--global-dimension-size-400);
`;

const vBoxCSS = (
  dividerCSS: ReturnType<typeof css>,
  height: number | string
) => css`
  ${dividerCSS}
  width: var(--global-dimension-size-400);
  height: ${typeof height === "number" ? `${height}px` : height};
  background: var(--global-background-color-default);
  margin-right: var(--global-dimension-size-400);
`;

const containerHCSS = (width: number | string) => css`
  border-left: 1px solid var(--global-border-color-default);
  border-right: 1px solid var(--global-border-color-default);
  padding: var(--global-dimension-size-400) 0;
  width: ${typeof width === "number" ? `${width}px` : width};
  margin: var(--global-dimension-size-200) var(--global-dimension-size-400);
`;

const containerVCSS = (height: number | string) => css`
  border-top: 1px solid var(--global-border-color-default);
  border-bottom: 1px solid var(--global-border-color-default);
  padding: 0 var(--global-dimension-size-400);
  height: ${typeof height === "number" ? `${height}px` : height};
  margin: var(--global-dimension-size-400) var(--global-dimension-size-200);
`;

const innerHBoxCSS = (dividerCSS: ReturnType<typeof css>) => css`
  ${dividerCSS}
  width: 100%;
  height: var(--global-dimension-size-0);
  background: var(--global-background-color-default);
`;

const innerVBoxCSS = (dividerCSS: ReturnType<typeof css>) => css`
  ${dividerCSS}
  height: 100%;
  width: var(--global-dimension-size-0);
  background: var(--global-background-color-default);
`;

/** A single horizontal faded divider. Docs only; hidden from sidebar. */
export const BasicExample: StoryFn = () => (
  <div css={containerHCSS(300)}>
    <div css={innerHBoxCSS(fadedDividerTopCSS)} />
  </div>
);

BasicExample.tags = ["!dev"];

export const HorizontalDivider: StoryFn = () => (
  <Flex direction="column" alignItems="center">
    {[300, 420, 900].flatMap((w) => [
      <div key={`top-bare-${w}`} css={hBoxCSS(fadedDividerTopCSS, w)} />,
      <div key={`top-contained-${w}`} css={containerHCSS(w)}>
        <div css={innerHBoxCSS(fadedDividerTopCSS)} />
      </div>,
    ])}
    {[300, 420, 900].flatMap((w) => [
      <div key={`bottom-bare-${w}`} css={hBoxCSS(fadedDividerBottomCSS, w)} />,
      <div key={`bottom-contained-${w}`} css={containerHCSS(w)}>
        <div css={innerHBoxCSS(fadedDividerBottomCSS)} />
      </div>,
    ])}
  </Flex>
);

export const VerticalDivider: StoryFn = () => (
  <Flex direction="row" alignItems="center">
    {[320, 600, 900].flatMap((h) => [
      <div key={`left-bare-${h}`} css={vBoxCSS(fadedDividerLeftCSS, h)} />,
      <div key={`left-contained-${h}`} css={containerVCSS(h)}>
        <div css={innerVBoxCSS(fadedDividerLeftCSS)} />
      </div>,
    ])}
    {[320, 600, 900].flatMap((h) => [
      <div key={`right-bare-${h}`} css={vBoxCSS(fadedDividerRightCSS, h)} />,
      <div key={`right-contained-${h}`} css={containerVCSS(h)}>
        <div css={innerVBoxCSS(fadedDividerRightCSS)} />
      </div>,
    ])}
  </Flex>
);

/** Full-viewport horizontal — 100vw bars. Canvas only; hidden from docs. */
export const FullVWHorizontal: StoryFn = () => (
  <Flex direction="column" alignItems="center">
    <div css={hBoxCSS(fadedDividerTopCSS, "100vw")} />
    <div css={hBoxCSS(fadedDividerBottomCSS, "100vw")} />
  </Flex>
);
FullVWHorizontal.parameters = { docs: { disable: true } };

/** Full-viewport vertical — 100vh bars. Canvas only; hidden from docs. */
export const FullVHVertical: StoryFn = () => (
  <Flex direction="row" alignItems="center">
    <div css={vBoxCSS(fadedDividerLeftCSS, "100vh")} />
    <div css={vBoxCSS(fadedDividerRightCSS, "100vh")} />
  </Flex>
);
FullVHVertical.parameters = { docs: { disable: true } };

// ─────────────────────────────────────────────────────────────────────────────
// Divider Component Stories
// ─────────────────────────────────────────────────────────────────────────────

const dividerContainerCSS = css`
  width: 300px;
  padding: var(--global-dimension-size-200);
  background: var(--global-background-color-default);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  text-align: center;
`;

/** Divider component variants: solid (default) and fading. Docs only. */
export const DividerSolidVsFade: StoryFn = () => (
  <Flex direction="row" gap="size-400" wrap justifyContent="center">
    <div css={dividerContainerCSS}>
      solid (default)
      <Divider size="sm" />
      Uses --global-border-color-default
    </div>
    <div css={dividerContainerCSS}>
      fading
      <Divider size="sm" variant="fading" />
      Gradient fades at edges
    </div>
  </Flex>
);

/** Divider component sizes: xs, sm, md. Docs only. */
export const DividerSizes: StoryFn = () => (
  <Flex direction="row" gap="size-400" wrap justifyContent="center">
    <div css={dividerContainerCSS}>
      no size (no margin)
      <Divider variant="fading" />
      0px vertical margin
    </div>
    <div css={dividerContainerCSS}>
      size="xs"
      <Divider variant="fading" size="xs" />
      4px vertical margin
    </div>
    <div css={dividerContainerCSS}>
      size="sm"
      <Divider variant="fading" size="sm" />
      8px vertical margin
    </div>
    <div css={dividerContainerCSS}>
      size="md"
      <Divider variant="fading" size="md" />
      16px vertical margin
    </div>
  </Flex>
);
DividerSizes.tags = ["!dev"];
