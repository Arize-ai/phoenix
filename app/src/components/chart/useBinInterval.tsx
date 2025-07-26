import { useMemo } from "react";

import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * A react hook that returns the interval between ticks for a time series chart
 */
export function useBinInterval({ scale }: { scale: TimeBinScale }): number {
  return useMemo(() => {
    switch (scale) {
      case "YEAR":
        return 1;
      case "MONTH":
        return 1;
      case "WEEK":
      case "DAY":
        return 1;
      case "HOUR":
        return 1;
      case "MINUTE":
        return 5;
      default: {
        assertUnreachable(scale);
      }
    }
  }, [scale]);
}
