import type { BadgeColor } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import type { EvaluatorKind } from "@phoenix/types";

/**
 * Matches the annotator kind colors, since an evaluator of a kind writes
 * annotations of that kind.
 */
function getEvaluatorKindColor(kind: EvaluatorKind): BadgeColor {
  switch (kind) {
    case "LLM":
      return "purple";
    case "CODE":
    case "BUILTIN":
      return "cyan";
    default:
      return "neutral";
  }
}

export function EvaluatorKindBadge({ kind }: { kind: EvaluatorKind }) {
  return (
    <Badge color={getEvaluatorKindColor(kind)}>
      {/* BUILTIN historically rendered as CODE — keep that label aligned with CODE. */}
      {kind === "BUILTIN" ? "CODE" : kind}
    </Badge>
  );
}
