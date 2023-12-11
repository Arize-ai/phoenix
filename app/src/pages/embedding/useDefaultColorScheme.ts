import { useMemo } from "react";

import {
  DEFAULT_DARK_COLOR_SCHEME,
  DEFAULT_LIGHT_COLOR_SCHEME,
} from "@phoenix/constants/pointCloudConstants";
import { useTheme } from "@phoenix/contexts";

export function useDefaultColorScheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme === "light") {
      return DEFAULT_LIGHT_COLOR_SCHEME;
    }
    return DEFAULT_DARK_COLOR_SCHEME;
  }, [theme]);
}
