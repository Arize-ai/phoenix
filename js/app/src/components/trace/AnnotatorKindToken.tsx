import { Token } from "@phoenix/components";

type AnnotatorKind = "HUMAN" | "LLM" | "CODE";

export function AnnotatorKindToken(props: { kind: AnnotatorKind }) {
  const { kind } = props;
  return (
    <Token
      size="S"
      color={
        kind === "HUMAN"
          ? "var(--global-color-blue-500)"
          : "var(--global-color-orange-500)"
      }
    >
      {kind}
    </Token>
  );
}
