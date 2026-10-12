import { css } from "@emotion/react";

import { Badge } from "@phoenix/components";
import type { ComponentSize } from "@phoenix/components/core/types";

type BaselineExperimentBadgeProps = {
  size?: ComponentSize;
  /**
   * The badge text
   * @default "baseline"
   */
  label?: string;
};

// The Badge derives its colors from `--badge-base-color`, which it sets
// locally to a neutral gray. Override it from a wrapper with a descendant
// selector so it takes precedence over Badge's own declaration.
const baselineBadgeCSS = css`
  display: inline-flex;
  .badge {
    --badge-base-color: var(--global-color-indigo-500);
  }
`;

/**
 * A passive badge that indicates an experiment is the baseline.
 */
export function BaselineExperimentBadge({
  size = "S",
  label = "baseline",
}: BaselineExperimentBadgeProps) {
  return (
    <span css={baselineBadgeCSS}>
      <Badge size={size}>{label}</Badge>
    </span>
  );
}
