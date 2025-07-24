import { interpolateSinebow } from "d3-scale-chromatic";
import { darken, getContrast, lighten } from "polished";

import { ProviderTheme } from "@arizeai/components";

export const getWordColor = (word: string, theme: ProviderTheme) => {
  const charCode = word.charCodeAt(0);
  const baseColor = interpolateSinebow((charCode % 26) / 26);

  // Light mode gets a lower ratio because high values get contrast
  // at the expense of saturation, worsening differentiability
  const targetRatio = theme === "light" ? 3 : 5.0;
  const backgroundColor = theme === "light" ? "#ffffff" : "#000000";
  const currentRatio = getContrast(baseColor, backgroundColor);

  if (currentRatio >= targetRatio) return baseColor;

  let adjustedColor = baseColor;
  const adjustPct = 0.05;

  for (let i = 1; i <= 20; i++) {
    adjustedColor =
      theme === "light"
        ? darken(adjustPct * i, baseColor)
        : lighten(adjustPct * i, baseColor);

    const newRatio = getContrast(adjustedColor, backgroundColor);

    if (newRatio >= targetRatio) {
      break;
    }
  }

  return adjustedColor;
};
