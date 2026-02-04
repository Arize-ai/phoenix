import { useMemo } from "react";

import { Token, TokenProps } from "@phoenix/components/token";
import type { EvaluatorKind } from "@phoenix/types";

export function EvaluatorKindToken(props: {
  kind: EvaluatorKind;
  size?: TokenProps["size"];
}) {
  const { kind, size = "M" } = props;
  const color = useMemo<TokenProps["color"]>(() => {
    switch (kind) {
      case "LLM":
        return "var(--ac-global-color-orange-500)";
      case "BUILTIN":
        return "var(--ac-global-color-blue-500)";
      default:
        return "var(--ac-global-color-grey-300)";
    }
  }, [kind]);
  return (
    <Token color={color} size={size}>
      {kind}
    </Token>
  );
}
