import { css } from "@emotion/react";

/**
 * Adds a fading 1px divider on a given edge of an element via a `::after`
 * pseudo-element. Automatically adapts to light and dark themes via
 * `--global-color-gray-900-rgb` (black in light, white in dark).
 *
 * The element must form a stacking context — `position: relative` is included.
 *
 * Tune the intensity per-surface with CSS custom properties:
 *   `--faded-divider-opacity`       flanking gradient stops (default 0.06)
 *   `--faded-divider-opacity-peak`  center gradient stop (default 0.12)
 */
function makeFadedDividerCSS(edge: "top" | "bottom" | "left" | "right") {
  const isHorizontal = edge === "top" || edge === "bottom";
  return css`
    position: relative;
    &::after {
      content: "";
      position: absolute;
      ${edge}: 0;
      ${isHorizontal ? "left: 0; right: 0;" : "top: 0; bottom: 0;"}
      ${isHorizontal ? "height: 1px;" : "width: 1px;"}
      background: linear-gradient(
        ${isHorizontal ? "to right" : "to bottom"},
        transparent,
        rgba(var(--global-color-gray-900-rgb), var(--faded-divider-opacity, 0.06)) 15%,
        rgba(var(--global-color-gray-900-rgb), var(--faded-divider-opacity-peak, 0.12)) 50%,
        rgba(var(--global-color-gray-900-rgb), var(--faded-divider-opacity, 0.06)) 85%,
        transparent
      );
    }
  `;
}

export const fadedDividerTopCSS = makeFadedDividerCSS("top");
export const fadedDividerBottomCSS = makeFadedDividerCSS("bottom");
export const fadedDividerLeftCSS = makeFadedDividerCSS("left");
export const fadedDividerRightCSS = makeFadedDividerCSS("right");
