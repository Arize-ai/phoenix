import { generateInstanceId, PlaygroundInstance } from "@phoenix/store";
import {
  ChatMessageRole,
  chatMessageRoles,
} from "@phoenix/store/playgroundStore";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { ChatRoleMap, DEFAULT_CHAT_ROLE } from "./constants";
import { llmAttributesSchema } from "./schemas";
import { PlaygroundSpan } from "./spanPlaygroundPageLoader";

/**
 * Checks if a string is a valid chat message role
 */
export function isChatMessageRole(role: unknown): role is ChatMessageRole {
  return chatMessageRoles.includes(role as ChatMessageRole);
}

/**
 * Takes a string role and attempts to map the role to a valid ChatMessageRole.
 * If the role is not found, it will default to {@link DEFAULT_CHAT_ROLE}.
 * @param role the role to map
 * @returns ChatMessageRole
 *
 * NB: Only exported for testing
 */
export function getChatRole(role: string): ChatMessageRole {
  if (isChatMessageRole(role)) {
    return role;
  }

  for (const [role, acceptedValues] of Object.entries(ChatRoleMap)) {
    if (acceptedValues.includes(role)) {
      return role as ChatMessageRole;
    }
  }
  return DEFAULT_CHAT_ROLE;
}

export function transformSpanAttributesToPlaygroundInstance(
  span: PlaygroundSpan
): PlaygroundInstance | null {
  const { json: parsedAttributes, parseError } = safelyParseJSON(
    span.attributes
  );
  if (parseError) {
    throw new Error("Invalid span attributes, attributes must be valid JSON");
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
      messages: data.llm.input_messages.map(({ message }) => {
        return {
          role: getChatRole(message.role),
          content: message.content,
        };
      }),
    },
    output: data.llm.output_messages,
    tools: undefined,
  };
}
