import React, { useMemo } from "react";
import { useLoaderData } from "react-router";

import { PlaygroundInstance } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "./Playground";
import { llmAttributesSchema } from "./schemas";
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
    throw new Error("Invalid span");
  }

  const playgroundInstance = transformSpanAttributesToPlaygroundInstance(span);

  return <Playground instances={[playgroundInstance]} />;
}
