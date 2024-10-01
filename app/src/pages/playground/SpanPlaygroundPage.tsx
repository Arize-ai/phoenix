import React, { useMemo } from "react";
import { useLoaderData } from "react-router";
import { z } from "zod";

import { PlaygroundInstance } from "@phoenix/store";

import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "./Playground";

type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;

const toolCallSchema = z
  .object({
    function: z
      .object({
        name: z.string(),
        arguments: z.string(),
      })
      .partial(),
  })
  .partial();

const messageSchema = z
  .object({
    role: z.string(),
    content: z.string(),
    name: z.string(),
    tool_calls: z.array(toolCallSchema),
  })
  .partial();

const llmAttributesSchema = z
  .object({
    model_name: z.string(),
    prompts: z.array(z.string()),
    prompt_template: z
      .object({
        template: z.string(),
        variables: z.record(z.string()),
      })
      .partial(),
  })
  .partial();

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

  const PlaygroundInstance = z.object({
    template: z.string(),
  });

  return <Playground />;
}

type MessageTemplate = {
  messages: { role: string; message: string }[];
};

const a = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      message: z.string(),
    })
  ),
});
function transformSpanAttributesToPlaygroundInstance(
  span: PlaygroundSpan
): PlaygroundInstance {
  const result = ZMessageTemplate.safeParse(span);
  if (!result.success) {
    throw new Error("Invalid data");
  }
  return result.data;
  // return {
  //   messages: data.messages.map(message => ({
  //     role: message.role,
  //     message: message.message
  //   }))
  // };
}
