import { parseToRgb } from "polished";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";
import { clampNumber } from "@phoenix/utils/numberUtils";

export type SequentialChartColors = {
  readonly blue100: string;
  readonly blue200: string;
  readonly blue300: string;
  readonly blue400: string;
  readonly blue500: string;
  readonly blue600: string;
  readonly blue700: string;
  readonly blue800: string;
  readonly blue900: string;
  readonly orange100: string;
  readonly orange200: string;
  readonly orange300: string;
  readonly orange400: string;
  readonly orange500: string;
  readonly purple100: string;
  readonly purple200: string;
  readonly purple300: string;
  readonly purple400: string;
  readonly purple500: string;
  readonly magenta100: string;
  readonly magenta200: string;
  readonly magenta300: string;
  readonly magenta400: string;
  readonly magenta500: string;
  readonly red100: string;
  readonly red200: string;
  readonly red300: string;
  readonly red400: string;
  readonly red500: string;
  readonly gray100: string;
  readonly gray200: string;
  readonly gray300: string;
  readonly gray400: string;
  readonly gray500: string;
  readonly gray600: string;
  readonly gray700: string;
  readonly default: string;
};

// Unified color palette using global CSS variables defined in `GlobalStyles.tsx`.
// The underlying CSS variable values change automatically with the active theme,
// so we can reference the same variables for both light and dark modes.

const cssVar = (name: string) => `var(${name})`;

const sequentialChartColors: SequentialChartColors = Object.freeze({
  // Blues
  blue100: cssVar("--global-color-blue-200"),
  blue200: cssVar("--global-color-blue-300"),
  blue300: cssVar("--global-color-blue-400"),
  blue400: cssVar("--global-color-blue-500"),
  blue500: cssVar("--global-color-blue-600"),
  blue600: cssVar("--global-color-blue-700"),
  blue700: cssVar("--global-color-blue-800"),
  blue800: cssVar("--global-color-blue-900"),
  blue900: cssVar("--global-color-blue-1000"),

  // Oranges
  orange100: cssVar("--global-color-orange-500"),
  orange200: cssVar("--global-color-orange-600"),
  orange300: cssVar("--global-color-orange-700"),
  orange400: cssVar("--global-color-orange-800"),
  orange500: cssVar("--global-color-orange-900"),

  // Purples
  purple100: cssVar("--global-color-purple-100"),
  purple200: cssVar("--global-color-purple-200"),
  purple300: cssVar("--global-color-purple-300"),
  purple400: cssVar("--global-color-purple-400"),
  purple500: cssVar("--global-color-purple-500"),

  // Pinks / Magentas
  magenta100: cssVar("--global-color-magenta-200"),
  magenta200: cssVar("--global-color-magenta-300"),
  magenta300: cssVar("--global-color-magenta-400"),
  magenta400: cssVar("--global-color-magenta-500"),
  magenta500: cssVar("--global-color-magenta-600"),

  // Reds
  red100: cssVar("--global-color-red-200"),
  red200: cssVar("--global-color-red-300"),
  red300: cssVar("--global-color-red-400"),
  red400: cssVar("--global-color-red-500"),
  red500: cssVar("--global-color-red-600"),

  // Grays (note: CSS variable names use "gray")
  gray100: cssVar("--global-color-gray-100"),
  gray200: cssVar("--global-color-gray-200"),
  gray300: cssVar("--global-color-gray-300"),
  gray400: cssVar("--global-color-gray-400"),
  gray500: cssVar("--global-color-gray-500"),
  gray600: cssVar("--global-color-gray-600"),
  gray700: cssVar("--global-color-gray-700"),

  // Fallback / default
  default: cssVar("--global-text-color-900"),
});

/**
 * The list of sequential colors that are available for use in the charting components.
 * This is a list of the keys of the sequentialChartColors object.
 */
export const SEQUENTIAL_CHART_COLORS = Object.keys(
  sequentialChartColors
) as (keyof SequentialChartColors)[];

export const useSequentialChartColors = (): SequentialChartColors => {
  return sequentialChartColors;
};

/**
 * Returns a color from the chart colors based on the incoming index
 * The colors are grouped into 5 shades of each color group
 *
 * @example
 * ```ts
 * getChartColor(0, ChartColors) // returns ChartColors.blue500
 * getChartColor(1, ChartColors) // returns ChartColors.orange500
 * getChartColor(2, ChartColors) // returns ChartColors.purple500
 * getChartColor(3, ChartColors) // returns ChartColors.pink500
 * getChartColor(4, ChartColors) // returns ChartColors.gray500
 * getChartColor(5, ChartColors) // returns ChartColors.blue400
 * getChartColor(6, ChartColors) // returns ChartColors.orange400
 * // ...
 * ```
 * @param index - item index that will be mapped into a color
 * @param colors - the colors to use, typically the result of useSequentialChartColors()
 * @returns a color from the chart colors based on the incoming index
 */
export const getChartColor = (index: number, colors: SequentialChartColors) => {
  const colorGroups = [
    ["blue", 5],
    ["orange", 5],
    ["purple", 5],
    ["pink", 5],
    ["gray", 5],
  ] as const;
  const groupCount = colorGroups.length;
  const groupIndex = index % groupCount;
  const shadeIndex = Math.floor(index / groupCount);
  const [group, maxShades] = colorGroups[groupIndex];
  // reduce in shades by 100 for each group, each iteration
  const shade = 500 - 100 * (shadeIndex % maxShades);
  const colorKey = `${group}${shade}` as keyof SequentialChartColors;
  return colors[colorKey] || colors.default;
};

export type SemanticChartColor = "danger" | "success" | "warning" | "info";

const semanticChartColors: Record<SemanticChartColor, string> = {
  danger: "var(--global-color-red-700)",
  success: "var(--global-color-celery-700)",
  warning: "var(--global-color-warning)",
  info: "var(--global-color-blue-700)",
};

export const SEMANTIC_CHART_COLORS = Object.keys(
  semanticChartColors
) as SemanticChartColor[];

export const useSemanticChartColors = (): Record<
  SemanticChartColor,
  string
> => {
  return semanticChartColors;
};

type CategoricalChartColor =
  | "category1"
  | "category2"
  | "category3"
  | "category4"
  | "category5"
  | "category6"
  | "category7"
  | "category8"
  | "category9"
  | "category10"
  | "category11"
  | "category12";

const CategoryChartLightColors: Record<CategoricalChartColor, string> = {
  category1: "var(--global-color-blue-700)",
  category2: "var(--global-color-purple-900)",
  category3: "var(--global-color-magenta-600)",
  category4: "var(--global-color-indigo-600)",
  category5: "var(--global-color-blue-900)",
  category6: "var(--global-color-indigo-1100)",
  category7: "var(--global-color-orange-600)",
  category8: "var(--global-color-celery-400)",
  category9: "var(--global-color-seafoam-600)",
  category10: "var(--global-color-green-1000)",
  category11: "var(--global-color-yellow-400)",
  category12: "var(--global-color-red-1100)",
};

const CategoryChartDarkColors: Record<CategoricalChartColor, string> = {
  category1: "var(--global-color-blue-700)",
  category2: "var(--global-color-purple-800)",
  category3: "var(--global-color-magenta-800)",
  category4: "var(--global-color-indigo-600)",
  category5: "var(--global-color-blue-900)",
  category6: "var(--global-color-indigo-1100)",
  category7: "var(--global-color-orange-600)",
  category8: "var(--global-color-celery-400)",
  category9: "var(--global-color-seafoam-600)",
  category10: "var(--global-color-green-1000)",
  category11: "var(--global-color-yellow-400)",
  category12: "var(--global-color-red-1100)",
};

export const useCategoryChartColors = (): Record<
  CategoricalChartColor,
  string
> => {
  const { theme } = useTheme();
  return useMemo(
    () =>
      theme === "dark" ? CategoryChartDarkColors : CategoryChartLightColors,
    [theme]
  );
};

export const CATEGORICAL_CHART_COLORS = Object.keys(
  CategoryChartLightColors
) as CategoricalChartColor[];

/**
 * Returns a categorical color for an item index, cycling through the palette
 * when the index exceeds the number of categories.
 *
 * @param index - item index that will be mapped into a color
 * @param colors - the colors to use, typically the result of useCategoryChartColors()
 */
export const getCategoryChartColor = ({
  index,
  colors,
}: {
  index: number;
  colors: Record<CategoricalChartColor, string>;
}) => colors[CATEGORICAL_CHART_COLORS[index % CATEGORICAL_CHART_COLORS.length]];

type GrayscaleCategoricalColor = "gray1" | "gray2" | "gray3" | "gray4";

const GrayscaleCategoricalLightColors: Record<
  GrayscaleCategoricalColor,
  string
> = {
  gray1: "var(--global-color-gray-800)",
  gray2: "var(--global-color-gray-600)",
  gray3: "var(--global-color-gray-500)",
  gray4: "var(--global-color-gray-400)",
};

const GrayscaleCategoricalDarkColors: Record<
  GrayscaleCategoricalColor,
  string
> = {
  gray1: "var(--global-color-gray-800)",
  gray2: "var(--global-color-gray-600)",
  gray3: "var(--global-color-gray-500)",
  gray4: "var(--global-color-gray-400)",
};

export const useGrayscaleCategoricalColors = (): Record<
  GrayscaleCategoricalColor,
  string
> => {
  const { theme } = useTheme();
  return useMemo(
    () =>
      theme === "dark"
        ? GrayscaleCategoricalDarkColors
        : GrayscaleCategoricalLightColors,
    [theme]
  );
};

export const GRAYSCALE_CATEGORICAL_COLORS = Object.keys(
  GrayscaleCategoricalLightColors
) as GrayscaleCategoricalColor[];

/**
 * A d3-scale-chromatic style interpolator: maps a normalized value
 * t ∈ [0, 1] to a CSS color (e.g. `interpolateViridis`, `interpolateBlues`).
 */
export type SequentialColorInterpolator = (t: number) => string;

/**
 * Sequential ramps for density-encoded charts (heatmaps, confusion matrices).
 * Interpolators are applied as-is: the densest value gets
 * `colorInterpolator(1)`, so a scale's 1-end is its most colorful. These
 * defaults run "more → more color" against each theme's page background.
 *
 * The stops mirror the `--global-color-blue-*` ramps in `GlobalStyles.tsx`
 * (dark blue-100…1000, light blue-200…1200). CSS variables can't be
 * interpolated in JS, so the values are inlined — keep them in sync with the
 * ramps if those ever change.
 */
const DARK_THEME_SEQUENTIAL_BLUES = [
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
] as const;

const LIGHT_THEME_SEQUENTIAL_BLUES = [
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
] as const;

const clamp01 = (t: number) => clampNumber({ value: t, min: 0, max: 1 });

/**
 * Builds a d3-scale-chromatic style interpolator from an ordered list of
 * color stops (piecewise-linear in RGB). Order the stops fewer → more:
 * `colorInterpolator(1)` colors the densest value, so the last stop should
 * be the most colorful. Use it to run a brand ramp, a custom gradient, or
 * any palette as a sequential scale.
 */
export function createSequentialColorInterpolator(
  colors: readonly [string, string, ...string[]]
): SequentialColorInterpolator {
  const stops = colors.map((color) => parseToRgb(color));
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

const GRADIENT_STOP_COUNT = 12;

/**
 * Samples an interpolator into a CSS linear-gradient for legend bars.
 */
export function getSequentialGradientCSS({
  colorInterpolator,
}: {
  colorInterpolator: SequentialColorInterpolator;
}): string {
  const stops: string[] = [];
  for (let stopIndex = 0; stopIndex < GRADIENT_STOP_COUNT; stopIndex++) {
    stops.push(colorInterpolator(stopIndex / (GRADIENT_STOP_COUNT - 1)));
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const darkThemeBlueInterpolator = createSequentialColorInterpolator(
  DARK_THEME_SEQUENTIAL_BLUES
);
const lightThemeBlueInterpolator = createSequentialColorInterpolator(
  LIGHT_THEME_SEQUENTIAL_BLUES
);

/**
 * The theme-aware sequential blue scale, gaining color with density — dim
 * navy → vivid blue on dark, pale sky → deep blue on light. Pass an
 * interpolator to override the default; the override is returned as-is, so
 * callers can hold one prop and let this hook fill in the theme default.
 */
export function useSequentialBlueColorInterpolator(
  colorInterpolator?: SequentialColorInterpolator
): SequentialColorInterpolator {
  const { theme } = useTheme();
  const themeDefault =
    theme === "dark" ? darkThemeBlueInterpolator : lightThemeBlueInterpolator;
  return colorInterpolator ?? themeDefault;
}
