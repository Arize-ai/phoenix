import { describe, expect, it } from "vitest";

import type { ChatTemplateMessage } from "../chatTemplateMessagePreview";
import { getMessagePreview } from "../chatTemplateMessagePreview";

function message(content: unknown[]): ChatTemplateMessage {
  return { role: "USER", content } as ChatTemplateMessage;
}

const textPart = (text: string) => ({
  __typename: "TextContentPart" as const,
  text: { text },
});

const toolCallPart = (name: string, args: string) => ({
  __typename: "ToolCallContentPart" as const,
  toolCall: { toolCallId: "1", toolCall: { name, arguments: args } },
});

const toolResultPart = (result: unknown) => ({
  __typename: "ToolResultContentPart" as const,
  toolResult: { toolCallId: "1", result },
});

describe("getMessagePreview", () => {
  it("previews the text parts, joined", () => {
    expect(
      getMessagePreview(message([textPart("first"), textPart("second")]))
    ).toBe("first second");
  });

  it("falls back to what the message calls", () => {
    expect(
      getMessagePreview(message([toolCallPart("get_weather", '{"city":"SF"}')]))
    ).toBe('get_weather({"city":"SF"})');
  });

  // a message whose first result part is blank still has something worth
  // previewing in the ones after it
  it("reads every tool result rather than only the first", () => {
    expect(
      getMessagePreview(
        message([toolResultPart(""), toolResultPart("the real result")])
      )
    ).toBe("the real result");
  });

  it("returns undefined when there is nothing to show", () => {
    expect(getMessagePreview(message([]))).toBeUndefined();
    expect(getMessagePreview(message([textPart("")]))).toBeUndefined();
  });
});
