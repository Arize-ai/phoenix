import React, { useMemo } from "react";
import { css } from "@emotion/react";

import {
  detectToolCallProvider,
  LlmProviderToolCall,
} from "@phoenix/schemas/toolCallSchemas";

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

export function PlaygroundToolCall({
  toolCall,
}: {
  toolCall: LlmProviderToolCall | PartialOutputToolCall;
}) {
  const { name, input } = useMemo((): {
    name: string;
    input: Record<string, unknown> | string;
  } => {
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
      case null: {
        const partialToolCall = toolCall as PartialOutputToolCall;
        return {
          name: partialToolCall.function.name ?? "",
          input: partialToolCall.function.arguments,
        };
      }
      default:
        return {
          name: "",
          input: {},
        };
    }
  }, [toolCall]);

  return (
    <pre
      css={css`
        text-wrap: wrap;
        margin: var(--ac-global-dimension-static-size-100) 0;
      `}
    >
      {name}(
      {typeof input === "string" ? input : JSON.stringify(input, null, 2)})
    </pre>
  );
}
