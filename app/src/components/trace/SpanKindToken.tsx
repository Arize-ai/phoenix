import { useMemo } from "react";

import { Token, TokenProps } from "@phoenix/components/token";

export function SpanKindToken(props: {
  spanKind: string;
  size?: TokenProps["size"];
}) {
  const { spanKind, size = "M" } = props;
  const color = useMemo<TokenProps["color"]>(() => {
    let color: TokenProps["color"] = "var(--ac-global-color-grey-300)";
    switch (spanKind) {
      case "llm":
        color = "var(--ac-global-color-orange-500)";
        break;
      case "chain":
        color = "var(--ac-global-color-blue-500)";
        break;
      case "retriever":
        color = "var(--ac-global-color-seafoam-500)";
        break;
      case "reranker":
        color = "var(--ac-global-color-celery-500)";
        break;
      case "embedding":
        color = "var(--ac-global-color-indigo-500)";
        break;
      case "agent":
        color = "var(--ac-global-color-grey-500)";
        break;
      case "tool":
        color = "var(--ac-global-color-yellow-500)";
        break;
      case "evaluator":
        color = "var(--ac-global-color-indigo-500)";
        break;
      case "guardrail":
        color = "var(--ac-global-color-fuchsia-500)";
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
