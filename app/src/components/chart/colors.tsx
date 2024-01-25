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
  readonly gray100: string;
  readonly gray200: string;
  readonly gray300: string;
  readonly gray400: string;
  readonly gray500: string;
  readonly gray600: string;
  readonly gray700: string;
  readonly default: string;
  // Colors specific to the dataset role
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
  gray100: "#f0f0f0",
  gray200: "#d9d9d9",
  gray300: "#bdbdbd",
  gray400: "#969696",
  gray500: "#737373",
  gray600: "#525252",
  gray700: "#252525",
  default: "#ffffff",
  // Colors specific to the dataset role
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
  gray100: "#252525",
  gray200: "#525252",
  gray300: "#737373",
  gray400: "#969696",
  gray500: "#bdbdbd",
  gray600: "#d9d9d9",
  gray700: "#f0f0f0",
  // Colors specific to the dataset role
  primary: "#00add0",
  reference: "#4500d9",
});

export const useChartColors = (): ChartColors => {
  const { theme } = useTheme();
  return useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
};
