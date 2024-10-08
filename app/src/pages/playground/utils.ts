import { generateInstanceId, PlaygroundInstance } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { llmAttributesSchema } from "./schemas";
import { PlaygroundSpan } from "./types";

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
      messages: data.llm.input_messages.map(({ message }) => message),
    },
    output: data.llm.output_messages,
    tools: undefined,
  };
}
