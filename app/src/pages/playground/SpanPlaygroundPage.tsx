import React, { useMemo } from "react";
import { useLoaderData } from "react-router";

import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "./Playground";
import { transformSpanAttributesToPlaygroundInstance } from "./utils";

export function SpanPlaygroundPage() {
  const data = useLoaderData() as spanPlaygroundPageLoaderQuery$data;
  const span = useMemo(() => {
    if (data.span.__typename === "Span") {
      return data.span;
    }
    return null;
  }, [data.span]);

  if (!span) {
    throw new Error("Span not found");
  }

  const playgroundInstance = useMemo(
    () => transformSpanAttributesToPlaygroundInstance(span),
    [span]
  );

  return (
    <Playground
      instances={playgroundInstance != null ? [playgroundInstance] : undefined}
    />
  );
}
