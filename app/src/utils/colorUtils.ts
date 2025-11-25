import { interpolateSinebow } from "d3-scale-chromatic";
import { darken, getContrast, lighten } from "polished";

import { ProviderTheme } from "@phoenix/contexts";

// The amount to adjust the color by when we're trying to get a better contrast
const ADJUST_PCT = 0.05;

export const getWordColor = ({
  word,
  theme,
}: {
  word: string;
  theme: ProviderTheme;
}) => {
  const charCode = word.charCodeAt(0);
  let color = interpolateSinebow((charCode % 26) / 26);

  // Light mode gets a lower ratio because high values get contrast
  // at the expense of saturation, worsening differentiability
  const targetRatio = theme === "light" ? 3 : 5.0;
  const backgroundColor = theme === "light" ? "#fdfdfd" : "#0E0E0E";
  let ratio = getContrast(color, backgroundColor);

  while (ratio < targetRatio) {
    color =
      theme === "light"
        ? darken(ADJUST_PCT, color)
        : lighten(ADJUST_PCT, color);
    ratio = getContrast(color, backgroundColor);
  }

  return color;
};
