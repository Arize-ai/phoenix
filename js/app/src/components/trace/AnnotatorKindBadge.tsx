import type { BadgeColor } from "@phoenix/components/core/badge";
import { Badge } from "@phoenix/components/core/badge";
import type { FamilySize } from "@phoenix/components/core/types";
import type { AnnotatorKind } from "@phoenix/constants";

const colorByAnnotatorKind: Record<AnnotatorKind, BadgeColor> = {
  HUMAN: "blue",
  LLM: "purple",
  CODE: "cyan",
  DECISION: "magenta",
  AGENT: "seafoam",
};

const explanationByAnnotatorKind: Record<AnnotatorKind, string> = {
  HUMAN: "Added by a person.",
  LLM: "Produced by an LLM acting as a judge.",
  CODE: "Computed by code, such as a heuristic or a test.",
  DECISION:
    "Produced by a decision model, which returns a typed answer such as a choice or a score.",
  AGENT:
    "Produced by an AI agent that plans and calls tools over several steps.",
};

/**
 * A short explanation of who or what produced an annotation of this kind.
 */
export function getAnnotatorKindExplanation(kind: AnnotatorKind): string {
  return explanationByAnnotatorKind[kind];
}

/**
 * Who or what produced an annotation: a person, an LLM judge, code, a
 * decision model or an agent.
 */
export function AnnotatorKindBadge({
  kind,
  size = "M",
}: {
  kind: AnnotatorKind;
  size?: FamilySize;
}) {
  return (
    <Badge color={colorByAnnotatorKind[kind]} size={size}>
      {kind}
    </Badge>
  );
}
