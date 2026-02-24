import { useMemo } from "react";

import type { TokenProps } from "@phoenix/components/token";
import { Token } from "@phoenix/components/token";
import type { EvaluatorKind } from "@phoenix/types";

export function EvaluatorKindToken(props: {
  kind: EvaluatorKind;
  size?: TokenProps["size"];
}) {
  const { kind, size = "M" } = props;
  const color = useMemo<TokenProps["color"]>(() => {
    switch (kind) {
      case "LLM":
        return "var(--global-color-orange-500)";
      case "BUILTIN":
        return "var(--global-color-blue-500)";
      default:
        return "var(--global-color-gray-300)";
    }
  }, [kind]);
  return (
    <Token color={color} size={size}>
      {/* for now, all builtin evaluators are code evaluators */}
      {kind === "BUILTIN" ? "CODE" : kind}
    </Token>
  );
}
