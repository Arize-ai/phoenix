import React, { useMemo } from "react";

import { Label, LabelProps } from "@arizeai/components";

export function SpanKindLabel(props: { spanKind: string }) {
  const { spanKind } = props;
  const color = useMemo<LabelProps["color"]>(() => {
    let color: LabelProps["color"] = "gray";
    switch (spanKind) {
      case "llm":
        color = "orange";
        break;
      case "chain":
        color = "blue";
        break;
      case "retriever":
        color = "blue-1000";
        break;
      case "embedding":
        color = "indigo-1000";
        break;
      case "agent":
        color = "yellow-1000";
    }
    return color;
  }, [spanKind]);
  return <Label color={color}>{spanKind}</Label>;
}
