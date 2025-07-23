import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

export type ChartColors = {
  readonly blue100: string;
  readonly blue200: string;
  readonly blue300: string;
  readonly blue400: string;
  readonly blue500: string;
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
  readonly pink100: string;
  readonly pink200: string;
  readonly pink300: string;
  readonly pink400: string;
  readonly pink500: string;
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
  // Colors specific to the inferences role
  readonly primary: string;
  readonly reference: string;
};

const darkColors: ChartColors = Object.freeze({
  blue100: "#A4C7E0",
  blue200: "#7EB0D2",
  blue300: "#5899C5",
  blue400: "#3C80AE",
  blue500: "#2F6488",
  orange100: "#FECC95",
  orange200: "#FDB462",
  orange300: "#FC9C31",
  orange400: "#F78403",
  orange500: "#C46903",
  purple100: "#BEBADA",
  purple200: "#9E98C8",
  purple300: "#7F77B6",
  purple400: "#6157A3",
  purple500: "#4D4581",
  pink100: "#FCCDE5",
  pink200: "#F99FCD",
  pink300: "#F66FB4",
  pink400: "#F33F9B",
  pink500: "#F10E82",
  red100: "#FFCACA",
  red200: "#FFA6A6",
  red300: "#FF7171",
  red400: "#FF3235",
  red500: "#F80707",
  gray100: "#f0f0f0",
  gray200: "#d9d9d9",
  gray300: "#bdbdbd",
  gray400: "#969696",
  gray500: "#737373",
  gray600: "#525252",
  gray700: "#252525",
  default: "#ffffff",
  // Colors specific to the inferences role
  primary: "#9efcfd",
  reference: "#baa1f9",
});

const lightColors: ChartColors = Object.freeze({
  default: "#000000",
  blue100: "#2F6488",
  blue200: "#3C80AE",
  blue300: "#5899C5",
  blue400: "#7EB0D2",
  blue500: "#A4C7E0",
  orange100: "#C46903",
  orange200: "#F78403",
  orange300: "#FC9C31",
  orange400: "#FDB462",
  orange500: "#FECC95",
  purple100: "#4D4581",
  purple200: "#6157A3",
  purple300: "#7F77B6",
  purple400: "#9E98C8",
  purple500: "#BEBADA",
  pink100: "#F10E82",
  pink200: "#F33F9B",
  pink300: "#F66FB4",
  pink400: "#F99FCD",
  pink500: "#FCCDE5",
  red100: "#FFCACA",
  red200: "#FFA6A6",
  red300: "#FF7171",
  red400: "#FF3235",
  red500: "#F80707",
  gray100: "#252525",
  gray200: "#525252",
  gray300: "#737373",
  gray400: "#969696",
  gray500: "#bdbdbd",
  gray600: "#d9d9d9",
  gray700: "#f0f0f0",
  // Colors specific to the inferences role
  primary: "#00add0",
  reference: "#4500d9",
});

export const useChartColors = (): ChartColors => {
  const { theme } = useTheme();
  return useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
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
 * @param colors - the colors to use, typically the result of useChartColors()
 * @returns a color from the chart colors based on the incoming index
 */
export const getChartColor = (index: number, colors: ChartColors) => {
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
  const colorKey = `${group}${shade}` as keyof ChartColors;
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
  category1: "var(--ac-global-color-blue-900)",
  category2: "var(--ac-global-color-purple-1100)",
  category3: "var(--ac-global-color-magenta-800)",
  category4: "var(--ac-global-color-indigo-600)",
  category5: "var(--ac-global-color-blue-700)",
  category6: "var(--ac-global-color-indigo-1100)",
  category7: "var(--ac-global-color-orange-600)",
  category8: "var(--ac-global-color-celery-400)",
  category9: "var(--ac-global-color-seafoam-600)",
  category10: "var(--ac-global-color-green-1000)",
  category11: "var(--ac-global-color-yellow-400)",
  category12: "var(--ac-global-color-red-1100)",
};

const CategoryChartDarkColors: Record<CategoricalChartColor, string> = {
  category1: "var(--ac-global-color-blue-900)",
  category2: "var(--ac-global-color-purple-1100)",
  category3: "var(--ac-global-color-magenta-800)",
  category4: "var(--ac-global-color-indigo-600)",
  category5: "var(--ac-global-color-blue-700)",
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
