import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";

import { Badge } from "@phoenix/components";

import type { AnnotationTargetType } from "./types";

/**
 * Each target type gets its own hue so the badges are scannable at a glance.
 * The Badge derives its background, border, and text colors from
 * `--badge-base-color`, staying theme-aware. The `&&` raises specificity
 * above the Badge's own base-color declaration.
 */
const badgeCSSByTargetType: Record<AnnotationTargetType, SerializedStyles> = {
  span: css`
    && {
      --badge-base-color: var(--global-color-blue-500);
    }
  `,
  trace: css`
    && {
      --badge-base-color: var(--global-color-purple-500);
    }
  `,
  session: css`
    && {
      --badge-base-color: var(--global-color-green-500);
    }
  `,
};

/**
 * A badge naming what an annotation annotates — "span", "trace", or
 * "session" — so annotations of different target types can be told apart
 * wherever they appear side by side (detail popovers, column selectors).
 */
export function AnnotationTargetTypeBadge({
  targetType,
}: {
  targetType: AnnotationTargetType;
}) {
  return <Badge css={badgeCSSByTargetType[targetType]}>{targetType}</Badge>;
}
