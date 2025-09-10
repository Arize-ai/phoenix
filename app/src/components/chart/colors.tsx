import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

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
  readonly grey100: string;
  readonly grey200: string;
  readonly grey300: string;
  readonly grey400: string;
  readonly grey500: string;
  readonly grey600: string;
  readonly grey700: string;
  readonly default: string;
  // Colors specific to the inferences role
  readonly primary: string;
  readonly reference: string;
};

// Unified color palette using global CSS variables defined in `GlobalStyles.tsx`.
// The underlying CSS variable values change automatically with the active theme,
// so we can reference the same variables for both light and dark modes.

const cssVar = (name: string) => `var(${name})`;

const darkSequentialChartColors: SequentialChartColors = Object.freeze({
  // Blues
  blue100: cssVar("--ac-global-color-blue-200"),
  blue200: cssVar("--ac-global-color-blue-300"),
  blue300: cssVar("--ac-global-color-blue-400"),
  blue400: cssVar("--ac-global-color-blue-500"),
  blue500: cssVar("--ac-global-color-blue-600"),
  blue600: cssVar("--ac-global-color-blue-700"),
  blue700: cssVar("--ac-global-color-blue-800"),
  blue800: cssVar("--ac-global-color-blue-900"),
  blue900: cssVar("--ac-global-color-blue-1000"),

  // Oranges
  orange100: cssVar("--ac-global-color-orange-500"),
  orange200: cssVar("--ac-global-color-orange-600"),
  orange300: cssVar("--ac-global-color-orange-700"),
  orange400: cssVar("--ac-global-color-orange-800"),
  orange500: cssVar("--ac-global-color-orange-900"),

  // Purples
  purple100: cssVar("--ac-global-color-purple-100"),
  purple200: cssVar("--ac-global-color-purple-200"),
  purple300: cssVar("--ac-global-color-purple-300"),
  purple400: cssVar("--ac-global-color-purple-400"),
  purple500: cssVar("--ac-global-color-purple-500"),

  // Pinks / Magentas
  magenta100: cssVar("--ac-global-color-magenta-200"),
  magenta200: cssVar("--ac-global-color-magenta-300"),
  magenta300: cssVar("--ac-global-color-magenta-400"),
  magenta400: cssVar("--ac-global-color-magenta-500"),
  magenta500: cssVar("--ac-global-color-magenta-600"),

  // Reds
  red100: cssVar("--ac-global-color-red-200"),
  red200: cssVar("--ac-global-color-red-300"),
  red300: cssVar("--ac-global-color-red-400"),
  red400: cssVar("--ac-global-color-red-500"),
  red500: cssVar("--ac-global-color-red-600"),

  // Grays (note: CSS variable names use "grey")
  grey100: cssVar("--ac-global-color-grey-100"),
  grey200: cssVar("--ac-global-color-grey-200"),
  grey300: cssVar("--ac-global-color-grey-300"),
  grey400: cssVar("--ac-global-color-grey-400"),
  grey500: cssVar("--ac-global-color-grey-500"),
  grey600: cssVar("--ac-global-color-grey-600"),
  grey700: cssVar("--ac-global-color-grey-700"),

  // Fallback / default
  default: cssVar("--ac-global-text-color-900"),

  // Semantic colors for inferences
  primary: cssVar("--px-primary-color"),
  reference: cssVar("--px-reference-color"),
});

const lightSequentialChartColors: SequentialChartColors = Object.freeze({
  // Blues
  blue100: cssVar("--ac-global-color-blue-200"),
  blue200: cssVar("--ac-global-color-blue-300"),
  blue300: cssVar("--ac-global-color-blue-400"),
  blue400: cssVar("--ac-global-color-blue-500"),
  blue500: cssVar("--ac-global-color-blue-600"),
  blue600: cssVar("--ac-global-color-blue-700"),
  blue700: cssVar("--ac-global-color-blue-800"),
  blue800: cssVar("--ac-global-color-blue-900"),
  blue900: cssVar("--ac-global-color-blue-1000"),

  // Oranges
  orange100: cssVar("--ac-global-color-orange-500"),
  orange200: cssVar("--ac-global-color-orange-600"),
  orange300: cssVar("--ac-global-color-orange-700"),
  orange400: cssVar("--ac-global-color-orange-800"),
  orange500: cssVar("--ac-global-color-orange-900"),

  // Purples
  purple100: cssVar("--ac-global-color-purple-100"),
  purple200: cssVar("--ac-global-color-purple-200"),
  purple300: cssVar("--ac-global-color-purple-300"),
  purple400: cssVar("--ac-global-color-purple-400"),
  purple500: cssVar("--ac-global-color-purple-500"),

  // Pinks / Magentas
  magenta100: cssVar("--ac-global-color-magenta-200"),
  magenta200: cssVar("--ac-global-color-magenta-300"),
  magenta300: cssVar("--ac-global-color-magenta-400"),
  magenta400: cssVar("--ac-global-color-magenta-500"),
  magenta500: cssVar("--ac-global-color-magenta-600"),

  // Reds
  red100: cssVar("--ac-global-color-red-200"),
  red200: cssVar("--ac-global-color-red-300"),
  red300: cssVar("--ac-global-color-red-400"),
  red400: cssVar("--ac-global-color-red-500"),
  red500: cssVar("--ac-global-color-red-600"),

  // Grays (note: CSS variable names use "grey")
  grey100: cssVar("--ac-global-color-grey-100"),
  grey200: cssVar("--ac-global-color-grey-200"),
  grey300: cssVar("--ac-global-color-grey-300"),
  grey400: cssVar("--ac-global-color-grey-400"),
  grey500: cssVar("--ac-global-color-grey-500"),
  grey600: cssVar("--ac-global-color-grey-600"),
  grey700: cssVar("--ac-global-color-grey-700"),

  // Fallback / default
  default: cssVar("--ac-global-text-color-900"),

  // Semantic colors for inferences
  primary: cssVar("--px-primary-color"),
  reference: cssVar("--px-reference-color"),
});

/**
 * The list of sequential colors that are available for use in the charting components.
 * This is a list of the keys of the darkSequentialChartColors object.
 */
export const SEQUENTIAL_CHART_COLORS = Object.keys(
  darkSequentialChartColors
) as (keyof SequentialChartColors)[];

export const useSequentialChartColors = (): SequentialChartColors => {
  // We call useTheme() to subscribe to theme changes so that React components
  // using these colors will re-render when the theme toggles, even though the
  // color map itself is constant (CSS variables swap automatically).
  const { theme } = useTheme();
  return useMemo(
    () =>
      theme === "dark" ? darkSequentialChartColors : lightSequentialChartColors,
    [theme]
  );
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
 * getChartColor(4, ChartColors) // returns ChartColors.grey500
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

const SemanticChartLightColors: Record<SemanticChartColor, string> = {
  danger: "var(--ac-global-color-red-700)",
  success: "var(--ac-global-color-celery-700)",
  warning: "var(--ac-global-color-orange-700)",
  info: "var(--ac-global-color-blue-700)",
};

const SemanticChartDarkColors: Record<SemanticChartColor, string> = {
  danger: "var(--ac-global-color-red-700)",
  success: "var(--ac-global-color-celery-700)",
  warning: "var(--ac-global-color-orange-700)",
  info: "var(--ac-global-color-blue-700)",
};

export const SEMANTIC_CHART_COLORS = Object.keys(
  SemanticChartLightColors
) as SemanticChartColor[];

export const useSemanticChartColors = (): Record<
  SemanticChartColor,
  string
> => {
  const { theme } = useTheme();
  return useMemo(
    () =>
      theme === "dark" ? SemanticChartDarkColors : SemanticChartLightColors,
    [theme]
  );
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
  category1: "var(--ac-global-color-blue-700)",
  category2: "var(--ac-global-color-purple-900)",
  category3: "var(--ac-global-color-magenta-600)",
  category4: "var(--ac-global-color-indigo-600)",
  category5: "var(--ac-global-color-blue-900)",
  category6: "var(--ac-global-color-indigo-1100)",
  category7: "var(--ac-global-color-orange-600)",
  category8: "var(--ac-global-color-celery-400)",
  category9: "var(--ac-global-color-seafoam-600)",
  category10: "var(--ac-global-color-green-1000)",
  category11: "var(--ac-global-color-yellow-400)",
  category12: "var(--ac-global-color-red-1100)",
};

const CategoryChartDarkColors: Record<CategoricalChartColor, string> = {
  category1: "var(--ac-global-color-blue-700)",
  category2: "var(--ac-global-color-purple-800)",
  category3: "var(--ac-global-color-magenta-800)",
  category4: "var(--ac-global-color-indigo-600)",
  category5: "var(--ac-global-color-blue-900)",
  category6: "var(--ac-global-color-indigo-1100)",
  category7: "var(--ac-global-color-orange-600)",
  category8: "var(--ac-global-color-celery-400)",
  category9: "var(--ac-global-color-seafoam-600)",
  category10: "var(--ac-global-color-green-1000)",
  category11: "var(--ac-global-color-yellow-400)",
  category12: "var(--ac-global-color-red-1100)",
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
