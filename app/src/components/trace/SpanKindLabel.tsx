import React, { useMemo } from "react";

import { Label, LabelProps } from "@arizeai/components";

export function SpanKindLabel(props: { spanKind: string }) {
  const { spanKind } = props;
  const color = useMemo<LabelProps["color"]>(() => {
    let color: LabelProps["color"] = "grey-500";
    switch (spanKind) {
      case "llm":
        color = "orange-1000";
        break;
      case "chain":
        color = "blue-1000";
        break;
      case "retriever":
        color = "seafoam-1000";
        break;
      case "reranker":
        color = "celery-1000";
        break;
      case "embedding":
        color = "indigo-1000";
        break;
      case "agent":
        color = "grey-900";
        break;
      case "tool":
        color = "yellow-1200";
        break;
    }
    return color;
  }, [spanKind]);
  return <Label color={color}>{spanKind}</Label>;
}
