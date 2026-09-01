import { getLuminance, parseToRgb } from "polished";

import { useTheme } from "@phoenix/contexts";

import type { SequentialColorInterpolator } from "./confusionMatrixUtils";

/**
 * Interpolators are applied as-is: the densest cell gets
 * `colorInterpolator(1)`, so a scale's 1-end should be its most colorful.
 * These defaults run "more count → more color" against each theme's page
 * background.
 *
 * The stops mirror the `--global-color-blue-*` ramps in `GlobalStyles.tsx`
 * (dark blue-100…1000, light blue-200…1200). CSS variables can't be
 * interpolated in JS, so the values are inlined — keep them in sync with the
 * ramps if those ever change.
 */
const DARK_THEME_BLUES = [
  "#002651",
  "#00326a",
  "#004087",
  "#004ea6",
  "#005cc8",
  "#066ce7",
  "#1d80f5",
  "#4096f3",
  "#5eaaf7",
  "#7cbdfa",
];

const LIGHT_THEME_BLUES = [
  "#cae8ff",
  "#b5deff",
  "#96cefd",
  "#78bbfa",
  "#59a7f6",
  "#3892f3",
  "#147af3",
  "#0265dc",
  "#0054b6",
  "#004491",
  "#003571",
];

/**
 * Above this relative luminance a cell is light enough that dark ink is both
 * higher-contrast and easier to read; below it, light ink wins. Chosen so the
 * mid-range of common d3 scales (blues, viridis, magma) keeps light ink.
 */
const DARK_INK_LUMINANCE_THRESHOLD = 0.4;

const DARK_INK = "var(--global-static-color-black-900)";
const LIGHT_INK = "var(--global-static-color-white-900)";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * Builds a d3-scale-chromatic style interpolator from an ordered list of
 * color stops (piecewise-linear in RGB). Order the stops fewer → more:
 * `colorInterpolator(1)` colors the densest cell, so the last stop should be
 * the most colorful. Use it to run a brand ramp, a custom gradient, or any
 * palette as the matrix scale.
 */
export function createSequentialColorInterpolator(
  colors: string[]
): SequentialColorInterpolator {
  if (colors.length === 0) {
    throw new Error(
      "createSequentialColorInterpolator requires at least one color"
    );
  }
  const stops = colors.map((color) => parseToRgb(color));
  if (stops.length === 1) {
    const only = stops[0];
    return () => `rgb(${only.red}, ${only.green}, ${only.blue})`;
  }
  return (t: number) => {
    const clamped = clamp01(t);
    const segments = stops.length - 1;
    const segmentIndex = Math.min(Math.floor(clamped * segments), segments - 1);
    const fraction = clamped * segments - segmentIndex;
    const start = stops[segmentIndex];
    const end = stops[segmentIndex + 1];
    const red = Math.round(start.red + (end.red - start.red) * fraction);
    const green = Math.round(
      start.green + (end.green - start.green) * fraction
    );
    const blue = Math.round(start.blue + (end.blue - start.blue) * fraction);
    return `rgb(${red}, ${green}, ${blue})`;
  };
}

/**
 * Flips a sequential interpolator's direction — for scales whose colorful
 * end sits at 0 (e.g. `interpolateBlues` on a dark background).
 */
export function reverseColorInterpolator(
  colorInterpolator: SequentialColorInterpolator
): SequentialColorInterpolator {
  return (t: number) => colorInterpolator(1 - clamp01(t));
}

const darkThemeInterpolator =
  createSequentialColorInterpolator(DARK_THEME_BLUES);
const lightThemeInterpolator =
  createSequentialColorInterpolator(LIGHT_THEME_BLUES);

/**
 * The theme-aware default color scale for confusion matrices: the Phoenix
 * sequential blues, gaining color with density — dim navy → vivid blue on
 * dark, pale sky → deep blue on light. Callers can override with any
 * d3-scale-chromatic interpolator or `createSequentialColorInterpolator`
 * ramp.
 */
export function useDefaultConfusionMatrixColorInterpolator(): SequentialColorInterpolator {
  const { theme } = useTheme();
  return theme === "dark" ? darkThemeInterpolator : lightThemeInterpolator;
}

/**
 * Resolves the fill and a legible ink color for a cell at density t.
 */
export function getConfusionMatrixCellColors({
  colorInterpolator,
  density,
}: {
  colorInterpolator: SequentialColorInterpolator;
  density: number;
}): { backgroundColor: string; color: string } {
  const backgroundColor = colorInterpolator(clamp01(density));
  let color: string;
  try {
    color =
      getLuminance(backgroundColor) > DARK_INK_LUMINANCE_THRESHOLD
        ? DARK_INK
        : LIGHT_INK;
  } catch {
    // The interpolator returned a color polished can't parse (a var()
    // expression, oklch(), color-mix(), …) — fall back to the theme's
    // default text color rather than crashing the render.
    color = "var(--global-text-color-900)";
  }
  return { backgroundColor, color };
}

/**
 * Samples an interpolator into a CSS linear-gradient for legend bars.
 */
export function getSequentialGradientCSS({
  colorInterpolator,
  stopCount = 12,
}: {
  colorInterpolator: SequentialColorInterpolator;
  /**
   * How many samples to take across the scale; a gradient needs at least
   * two, so smaller values are clamped
   */
  stopCount?: number;
}): string {
  const sampleCount = Math.max(2, Math.floor(stopCount));
  const stops: string[] = [];
  for (let stopIndex = 0; stopIndex < sampleCount; stopIndex++) {
    stops.push(colorInterpolator(stopIndex / (sampleCount - 1)));
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
