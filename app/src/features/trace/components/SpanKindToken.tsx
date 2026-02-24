import { useMemo } from "react";

import type { TokenProps } from "@phoenix/components/token";
import { Token } from "@phoenix/components/token";

export function SpanKindToken(props: {
  spanKind: string;
  size?: TokenProps["size"];
}) {
  const { spanKind, size = "M" } = props;
  const color = useMemo<TokenProps["color"]>(() => {
    let color: TokenProps["color"] = "var(--global-color-gray-300)";
    switch (spanKind) {
      case "llm":
        color = "var(--global-color-orange-500)";
        break;
      case "prompt":
        color = "var(--global-color-orange-400)";
        break;
      case "chain":
        color = "var(--global-color-blue-500)";
        break;
      case "retriever":
        color = "var(--global-color-seafoam-500)";
        break;
      case "reranker":
        color = "var(--global-color-celery-500)";
        break;
      case "embedding":
        color = "var(--global-color-indigo-500)";
        break;
      case "agent":
        color = "var(--global-color-gray-500)";
        break;
      case "tool":
        color = "var(--global-color-yellow-500)";
        break;
      case "evaluator":
        color = "var(--global-color-indigo-500)";
        break;
      case "guardrail":
        color = "var(--global-color-fuchsia-500)";
        break;
    }
    return color;
  }, [spanKind]);
  return (
    <Token color={color} size={size}>
      {spanKind}
    </Token>
  );
}
