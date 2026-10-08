import { Text } from "@phoenix/components";
import { errorRateFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * An error rate as a percentage, colored by how high it is: green at zero,
 * orange above it, and red once most runs fail.
 */
export function ErrorRateText({ errorRate }: { errorRate: number | null }) {
  const color =
    errorRate === null
      ? undefined
      : errorRate >= 0.8
        ? "red-1100"
        : errorRate > 0
          ? "orange-1100"
          : "green-1100";
  return <Text color={color}>{errorRateFormatter(errorRate)}</Text>;
}
