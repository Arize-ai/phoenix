import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import {
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
    <div css={hBoxCSS(fadedDividerTopCSS, "100%")} />
  </div>
);

BasicExample.tags = ['!dev'];

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

