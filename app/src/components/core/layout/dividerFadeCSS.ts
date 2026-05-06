import { css } from "@emotion/react";

export const makeGradient = ({
  direction,
}: {
  direction: "to right" | "to bottom";
}) => `
  linear-gradient(
    ${direction},
    transparent,
    var(--global-border-color-default) clamp(48px, 15%, 128px),
    var(--global-border-color-default) 50%,
    var(--global-border-color-default) calc(100% - clamp(48px, 15%, 128px)),
    transparent
  )
`;

/**
 * Adds a fading 1px divider on a given edge of an element via a `::after`
 * pseudo-element. Automatically adapts to light and dark themes via
 * `--global-border-color-default`.
 *
 * The element must form a stacking context — `position: relative` is included.
 *
 * The clamp() constraints ensure the fade looks good in narrow containers
 * (where 15% would be too small) and wide containers (where 15% would be too generous).
 */
function makeDividerFadeCSS(edge: "top" | "bottom" | "left" | "right") {
  const isHorizontal = edge === "top" || edge === "bottom";
  return css`
    position: relative;
    &::after {
      content: "";
      position: absolute;
      ${edge}: 0;
      ${isHorizontal ? "left: 0; right: 0;" : "top: 0; bottom: 0;"}
      ${isHorizontal ? "height: 1px;" : "width: 1px;"}
      background: ${makeGradient({
        direction: isHorizontal ? "to right" : "to bottom",
      })};
      opacity: 0.8;
    }
  `;
}

export const fadedDividerTopCSS = makeDividerFadeCSS("top");
export const fadedDividerBottomCSS = makeDividerFadeCSS("bottom");
export const fadedDividerLeftCSS = makeDividerFadeCSS("left");
export const fadedDividerRightCSS = makeDividerFadeCSS("right");