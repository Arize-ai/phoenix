import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@phoenix/store";

import { getMessagePreview } from "../messagePreview";

function message(patch: Partial<ChatMessage>): ChatMessage {
  return { id: 1, role: "user", content: "", ...patch } as ChatMessage;
}

describe("getMessagePreview", () => {
  it("previews the content of a message that has one", () => {
    expect(getMessagePreview(message({ content: "hello there" }))).toBe(
      "hello there"
    );
  });

  it("previews what an assistant turn called, with its arguments", () => {
    expect(
      getMessagePreview(
        message({
          role: "ai",
          content: "",
          toolCalls: [
            {
              id: "1",
              function: { name: "get_weather", arguments: { city: "SF" } },
            },
          ],
        })
      )
    ).toBe('get_weather({ "city": "SF" })');
  });

  // `aiMessageMode` opens on tool calls whenever the message has any, so
  // previewing the text would describe a card body that is never rendered
  it("prefers tool calls over content, matching how the card opens", () => {
    expect(
      getMessagePreview(
        message({
          role: "ai",
          content: "some text the expanded card will not show",
          toolCalls: [
            { id: "1", function: { name: "get_weather", arguments: {} } },
          ],
        })
      )
    ).toBe("get_weather({})");
  });

  // switching a message to the tool role seeds its content with a JSON-encoded
  // empty string, which must not preview as a pair of quote marks
  it("treats a freshly created tool message as having nothing to show", () => {
    expect(
      getMessagePreview(message({ role: "tool", content: '""' }))
    ).toBeUndefined();
  });

  it("reads a tool result through its JSON encoding", () => {
    expect(
      getMessagePreview(
        message({ role: "tool", content: '"{\\"temp\\": 75}"' })
      )
    ).toBe('{"temp": 75}');
  });

  it("returns undefined for a message with nothing to show", () => {
    expect(getMessagePreview(message({ content: "" }))).toBeUndefined();
    expect(getMessagePreview(message({ content: undefined }))).toBeUndefined();
  });
});
