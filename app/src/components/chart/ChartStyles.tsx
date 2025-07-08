import { css } from "@emotion/react";

// This file uses some utils to compile tokens that conform
// to the conventions in GlobalStyles.tsx, while being more
// ergonomic to draft and maintain, with light and dark vals
// beside each other instead of many lines apart.

interface ChartTokenValue {
  light: string;
  dark: string;
}

interface ChartTokens {
  [tokenName: string]: ChartTokenValue;
}

const globalColor = (
  colorName: string,
  light: number,
  dark: number
): ChartTokenValue => ({
  light: `var(--ac-global-color-${colorName}-${light})`,
  dark: `var(--ac-global-color-${colorName}-${dark})`,
});

const chartTokens: ChartTokens = {
  // would prefer 550 for light theme, if it existed
  "chart-axis-text-color": globalColor("grey", 600, 500),
  // solid lines on the left and bottom
  "chart-border-line-color": globalColor("grey", 300, 300),
  // dashed lines spanning the chart
  "chart-grid-line-color": globalColor("grey", 300, 300),
  // gradient colors for bars
  "chart-bar-blue-gradient-start": globalColor("blue", 800, 700),
  "chart-bar-blue-gradient-end": globalColor("blue", 600, 500),
  // bar opacities for hover states
  "chart-bar-resting-opacity": { light: "1", dark: "1" },
  "chart-bar-disabled-opacity": { light: "0.6", dark: "0.4" },
};

function generateChartThemeCSS(theme: "light" | "dark") {
  const tokenDeclarations = Object.entries(chartTokens)
    .map(([tokenName, values]) => {
      const resolvedValue = values[theme];
      return `    --ac-global-${tokenName}: ${resolvedValue};`;
    })
    .join("\n");

  return css`
    .ac-theme--${theme} {
      /* Chart colors for ${theme} theme */
      ${tokenDeclarations}
    }
  `;
}

export const darkChartThemeCSS = generateChartThemeCSS("dark");
export const lightChartThemeCSS = generateChartThemeCSS("light");

export const chartThemeCSS = (theme: "dark" | "light") =>
  theme === "dark" ? darkChartThemeCSS : lightChartThemeCSS;
