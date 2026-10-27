import { Token } from "@phoenix/components";
import type { AnnotatorKind } from "@phoenix/constants";

const colorByAnnotatorKind: Record<AnnotatorKind, string> = {
  HUMAN: "var(--global-color-blue-500)",
  LLM: "var(--global-color-orange-500)",
  CODE: "var(--global-color-orange-500)",
  DECISION: "var(--global-color-magenta-500)",
};

export function AnnotatorKindToken(props: { kind: AnnotatorKind }) {
  const { kind } = props;
  return (
    <Token size="S" color={colorByAnnotatorKind[kind]}>
      {kind}
    </Token>
  );
}
