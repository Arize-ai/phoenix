import React, { useMemo } from "react";

import { Token, TokenProps } from "@phoenix/components/token";

export function SpanKindToken(props: { spanKind: string }) {
  const { spanKind } = props;
  const color = useMemo<TokenProps["color"]>(() => {
    let color: TokenProps["color"] = "var(--ac-global-color-grey-900)";
    switch (spanKind) {
      case "llm":
        color = "var(--ac-global-color-orange-900)";
        break;
      case "chain":
        color = "var(--ac-global-color-blue-900)";
        break;
      case "retriever":
        color = "var(--ac-global-color-seafoam-900)";
        break;
      case "reranker":
        color = "var(--ac-global-color-celery-900)";
        break;
      case "embedding":
        color = "var(--ac-global-color-indigo-900)";
        break;
      case "agent":
        color = "var(--ac-global-color-grey-900)";
        break;
      case "tool":
        color = "var(--ac-global-color-yellow-900)";
        break;
      case "evaluator":
        color = "var(--ac-global-color-indigo-900)";
        break;
      case "guardrail":
        color = "var(--ac-global-color-fuchsia-900)";
        break;
    }
    return color;
  }, [spanKind]);
  return (
    <Token color={color} size="M">
      {spanKind}
    </Token>
  );
}
