import React, { useMemo } from "react";
import { css } from "@emotion/react";

import {
  detectToolCallProvider,
  LlmProviderToolCall,
} from "@phoenix/schemas/toolCallSchemas";

export function PlaygroundToolCall({
  toolCall,
}: {
  toolCall: LlmProviderToolCall;
}) {
  const { name, input } = useMemo((): {
    name: string;
    input: Record<string, unknown>;
  } => {
    const { provider, validatedToolCall } = detectToolCallProvider(toolCall);
    switch (provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return {
          name: validatedToolCall.function.name,
          input:
            typeof validatedToolCall.function.arguments === "string"
              ? JSON.parse(validatedToolCall.function.arguments)
              : validatedToolCall.function.arguments,
        };

      case "ANTHROPIC":
        return {
          name: validatedToolCall.name,
          input: validatedToolCall.input,
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
      {name}({JSON.stringify(input, null, 2)})
    </pre>
  );
}
