import type { BadgeColor } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";

import type { AnnotationTargetType } from "./types";

/** Each target type gets its own hue so the badges are scannable at a glance. */
const colorByTargetType: Record<AnnotationTargetType, BadgeColor> = {
  span: "blue",
  trace: "purple",
  session: "seafoam",
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
  return (
    <Badge size="S" color={colorByTargetType[targetType]}>
      {targetType}
    </Badge>
  );
}
