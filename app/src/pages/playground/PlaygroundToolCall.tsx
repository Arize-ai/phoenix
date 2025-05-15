import { useMemo } from "react";
import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import {
  detectToolCallProvider,
  LlmProviderToolCall,
} from "@phoenix/schemas/toolCallSchemas";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/**
 * A partial tool call, the result of streaming a tool call back to the client
 * The arguments are a string since they are not complete and thus not fully JSON serializable
 */
export type PartialOutputToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

const isPartialOutputToolCall = (
  toolCall: LlmProviderToolCall | PartialOutputToolCall
): toolCall is PartialOutputToolCall => {
  const partialOutputToolCall = toolCall as PartialOutputToolCall;
  if (!isStringKeyedObject(partialOutputToolCall.function)) {
    return false;
  }
  return typeof partialOutputToolCall.function.arguments === "string";
};

export function PlaygroundToolCall({
  toolCall,
}: {
  toolCall: LlmProviderToolCall | PartialOutputToolCall;
}) {
  const functionDisplay = useMemo((): {
    name: string;
    input: Record<string, unknown> | string;
  } | null => {
    const { provider, validatedToolCall } = detectToolCallProvider(toolCall);
    switch (provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return {
          name: validatedToolCall.function.name,
          input: validatedToolCall.function.arguments,
        };

      case "ANTHROPIC":
        return {
          name: validatedToolCall.name,
          input: validatedToolCall.input,
        };
      case "UNKNOWN": {
        // This should never be the case, happen but we should handle it in case the server returns an invalid tool call
        if (!isPartialOutputToolCall(toolCall)) {
          return null;
        }
        const { json } = safelyParseJSON(toolCall.function.arguments);

        return {
          name: toolCall.function.name ?? "",
          // Parse valid input here so we can format it nicely below, this happens when the toolCall is completely returned
          input: isStringKeyedObject(json) ? json : toolCall.function.arguments,
        };
      }
      default:
        return assertUnreachable(provider);
    }
  }, [toolCall]);

  return functionDisplay == null ? (
    <Text>Invalid tool call format: {JSON.stringify(toolCall)}</Text>
  ) : (
    <pre
      css={css`
        text-wrap: wrap;
        margin: var(--ac-global-dimension-static-size-100) 0;
      `}
    >
      {functionDisplay.name}(
      {typeof functionDisplay.input === "string"
        ? functionDisplay.input
        : JSON.stringify(functionDisplay.input, null, 2)}
      )
    </pre>
  );
}
