import { useMemo } from "react";

import { getWordColor } from "@phoenix/utils/colorUtils";

export const useWordColor = (word: string) => {
  const color = useMemo(() => {
    return getWordColor(word);
  }, [word]);
  return color;
};
