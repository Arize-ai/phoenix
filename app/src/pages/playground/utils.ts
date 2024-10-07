import {
  INITIAL_PLAYGROUND_INSTANCE_ID,
  PlaygroundInstance,
} from "@phoenix/store";
import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { llmAttributesSchema } from "./schemas";

type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;

export function transformSpanAttributesToPlaygroundInstance(
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
    id: INITIAL_PLAYGROUND_INSTANCE_ID,
    activeRunId: null,
    isRunning: false,
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
