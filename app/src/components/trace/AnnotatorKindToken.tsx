import React from "react";

import { Token } from "@phoenix/components";

type AnnotatorKind = "HUMAN" | "LLM";

export function AnnotatorKindToken(props: { kind: AnnotatorKind }) {
  const { kind } = props;
  return (
    <Token
      size="S"
      color={
        kind === "HUMAN"
          ? "var(--ac-global-color-blue-500) "
          : "var(--ac-global-color-orange-500)"
      }
    >
      {kind}
    </Token>
  );
}
