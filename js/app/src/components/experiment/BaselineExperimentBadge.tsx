import { Badge } from "@phoenix/components";
import type { FamilySize } from "@phoenix/components/core/types";

type BaselineExperimentBadgeProps = {
  /**
   * @default "S"
   */
  size?: FamilySize;
  /**
   * The badge text
   * @default "baseline"
   */
  label?: string;
};

/**
 * Marks the experiment the others in a comparison are measured against.
 */
export function BaselineExperimentBadge({
  size = "S",
  label = "baseline",
}: BaselineExperimentBadgeProps) {
  return (
    <Badge color="indigo" size={size}>
      {label}
    </Badge>
  );
}
