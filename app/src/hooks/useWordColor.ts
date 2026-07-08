import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";

export const useWordColor = (word: string) => {
  const { theme } = useTheme();
  const color = useMemo(() => {
    return getWordColor({ word, theme });
  }, [word, theme]);
  return color;
};
