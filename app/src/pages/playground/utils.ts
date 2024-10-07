import { generateInstanceId, PlaygroundInstance } from "@phoenix/store";
import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { llmAttributesSchema } from "./schemas";

type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;

export function transformSpanAttributesToPlaygroundInstance(
  span: PlaygroundSpan
): PlaygroundInstance | null {
  const { json: parsedAttributes, parseError } = safelyParseJSON(
    span.attributes
  );
  if (parseError) {
    throw new Error("Invalid attributes");
  }
  const { data, success } = llmAttributesSchema.safeParse(parsedAttributes);
  if (!success) {
    return null;
  }
  // TODO(parker): add support for tools, variables, and input / output variants
  // https://github.com/Arize-ai/phoenix/issues/4886
  return {
    id: generateInstanceId(),
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
