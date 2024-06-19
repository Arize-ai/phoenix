import { useMemo } from "react";
import { interpolateSinebow } from "d3-scale-chromatic";

export const useWordColor = (word: string) => {
  const color = useMemo(() => {
    // Derive a color from the label first character
    const charCode = word.charCodeAt(0);
    return interpolateSinebow((charCode % 26) / 26);
  }, [word]);
  return color;
};
