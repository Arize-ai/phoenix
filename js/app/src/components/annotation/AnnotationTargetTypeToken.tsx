import { Token } from "@phoenix/components";

import type { AnnotationTargetType } from "./types";

/** Each target type gets its own hue so the pills are scannable at a glance. */
const colorByTargetType: Record<AnnotationTargetType, string> = {
  span: "var(--global-color-blue-500)",
  trace: "var(--global-color-purple-500)",
  session: "var(--global-color-green-500)",
};

/**
 * A pill naming what an annotation annotates — "span", "trace", or
 * "session" — so annotations of different target types can be told apart
 * wherever they appear side by side (detail popovers, column selectors).
 */
export function AnnotationTargetTypeToken({
  targetType,
}: {
  targetType: AnnotationTargetType;
}) {
  return (
    <Token size="S" color={colorByTargetType[targetType]}>
      {targetType}
    </Token>
  );
}
