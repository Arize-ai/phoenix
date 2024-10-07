import React, { useMemo } from "react";
import { useLoaderData } from "react-router";

import { PlaygroundInstance } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "./Playground";
import { llmAttributesSchema } from "./schemas";

type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;

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

function transformSpanAttributesToPlaygroundInstance(
  span: PlaygroundSpan
): PlaygroundInstance {
  const { json: parsedAttributes, parseError } = safelyParseJSON(
    span.attributes
  );
  if (parseError) {
    throw new Error("Invalid attributes");
  }
  const { data, success } = llmAttributesSchema.safeParse(parsedAttributes);
  if (!success) {
    throw new Error("Invalid data");
  }
  return {
    id: 1,
    input: {
      variables: {},
    },
    template: {
      __type: "chat",
      messages: data["llm.input_messages"],
    },
    output: data["llm.output_messages"],
    tools: undefined,
  };
}
