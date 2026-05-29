import { rewindMessages } from "@phoenix/agent/chat/rewindMessages";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

function userMessage(id: string, text: string): AgentUIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function assistantMessage(
  id: string,
  parts: AgentUIMessage["parts"]
): AgentUIMessage {
  return { id, role: "assistant", parts };
}

const TRANSCRIPT: AgentUIMessage[] = [
  userMessage("user-1", "first question"),
  assistantMessage("assistant-1", [{ type: "text", text: "first answer" }]),
  userMessage("user-2", "second question"),
  assistantMessage("assistant-2", [{ type: "text", text: "second answer" }]),
];

describe("rewindMessages", () => {
  it("returns null when the message id is not found", () => {
    expect(
      rewindMessages({ messages: TRANSCRIPT, messageId: "missing" })
    ).toBeNull();
  });

  it("keeps everything up to and including an assistant target", () => {
    const result = rewindMessages({
      messages: TRANSCRIPT,
      messageId: "assistant-1",
    });

    expect(result?.restoredInput).toBeNull();
    expect(result?.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
  });

  it("removes a user target and everything after, restoring its text", () => {
    const result = rewindMessages({
      messages: TRANSCRIPT,
      messageId: "user-2",
    });

    expect(result?.restoredInput).toBe("second question");
    expect(result?.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
  });

  it("restores the full text of a multi-part user message", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [
          { type: "text", text: "hello " },
          { type: "text", text: "world" },
        ],
      },
    ];

    const result = rewindMessages({ messages, messageId: "user-1" });

    expect(result?.restoredInput).toBe("hello world");
    expect(result?.messages).toEqual([]);
  });

  it("strips pending tool calls on the chosen assistant turn", () => {
    const messages: AgentUIMessage[] = [
      userMessage("user-1", "do a thing"),
      assistantMessage("assistant-1", [
        { type: "text", text: "on it" },
        {
          type: "tool-do_thing",
          toolCallId: "call-resolved",
          state: "output-available",
          input: {},
          output: "ok",
        },
        {
          type: "tool-do_thing",
          toolCallId: "call-pending",
          state: "input-available",
          input: {},
        },
      ]),
    ];

    const result = rewindMessages({ messages, messageId: "assistant-1" });

    const toolParts =
      result?.messages[1]?.parts.filter((part) =>
        part.type.startsWith("tool-")
      ) ?? [];
    expect(toolParts).toHaveLength(1);
    expect(
      toolParts.map((part) =>
        "toolCallId" in part ? part.toolCallId : undefined
      )
    ).toEqual(["call-resolved"]);
  });

  it("preserves earlier turns' tool calls untouched", () => {
    const messages: AgentUIMessage[] = [
      userMessage("user-1", "do a thing"),
      assistantMessage("assistant-1", [
        {
          type: "tool-do_thing",
          toolCallId: "call-1",
          state: "input-available",
          input: {},
        },
      ]),
      assistantMessage("assistant-2", [{ type: "text", text: "later" }]),
    ];

    const result = rewindMessages({ messages, messageId: "assistant-2" });

    // assistant-1 is earlier than the target and must keep its pending call.
    expect(result?.messages[1]?.parts).toHaveLength(1);
  });
});
