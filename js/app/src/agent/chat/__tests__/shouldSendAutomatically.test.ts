import type { UIMessage } from "ai";

import {
  getFlushableClientToolOutputs,
  shouldKeepTurnOpenForPendingToolOutput,
  shouldSendAutomaticallyAfterToolOutput,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import {
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";

function createMessage(message: UIMessage): UIMessage {
  return message;
}

describe("shouldSendAutomaticallyAfterToolOutput", () => {
  it("continues after ordinary completed tool calls", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output: "done",
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds: {},
      })
    ).toBe(true);
  });

  it("continues after ordinary tool errors", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-error",
            input: {},
            errorText: "The tool failed.",
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds: {},
      })
    ).toBe(true);
  });

  it("does not continue after tool calls marked interrupted by this client", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-error",
            input: {},
            errorText: "The user has interrupted this tool call.",
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds: { "tool-call-1": true },
      })
    ).toBe(false);
  });

  it("does not continue after tool parts persisted with an interrupted outcome", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output:
              "The tool call was interrupted before a result was produced.",
            callProviderMetadata: {
              phoenix: {
                toolExecutionEnvironment: "client",
                outcome: "interrupted",
              },
            },
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds: {},
      })
    ).toBe(false);
  });

  it("ignores marks for tool calls that are not on the trailing message", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "output-available",
            input: {},
            output: "done",
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds: { "tool-call-from-older-turn": true },
      })
    ).toBe(true);
  });
});

describe("getFlushableClientToolOutputs", () => {
  const CLIENT_CALL_METADATA = {
    phoenix: {
      toolExecutionEnvironment: "client",
      toolInputEmittedAt: "2026-08-05T20:35:35+00:00",
    },
  };

  function partiallyResolvedAssistantMessage(): UIMessage {
    return createMessage({
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-resolved",
          state: "output-available",
          input: {},
          output: { applied: true },
          callProviderMetadata: CLIENT_CALL_METADATA,
        },
        {
          type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-pending",
          state: "input-available",
          input: {},
          callProviderMetadata: CLIENT_CALL_METADATA,
        },
      ],
    });
  }

  it("returns resolved client outputs while sibling calls stay pending", () => {
    const outputs = getFlushableClientToolOutputs({
      message: partiallyResolvedAssistantMessage(),
      locallyInterruptedToolCallIds: {},
    });

    expect(outputs.map((output) => output.toolCallId)).toEqual([
      "tool-call-resolved",
    ]);
  });

  it("returns nothing once every call has resolved", () => {
    const message = createMessage({
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-resolved",
          state: "output-available",
          input: {},
          output: { applied: true },
          callProviderMetadata: CLIENT_CALL_METADATA,
        },
      ],
    });

    // The normal chat continuation carries the outputs instead.
    expect(
      getFlushableClientToolOutputs({
        message,
        locallyInterruptedToolCallIds: {},
      })
    ).toEqual([]);
  });

  it("returns nothing when the tail holds an interrupted output", () => {
    const message = partiallyResolvedAssistantMessage();
    message.parts.push({
      type: `tool-${READ_PROMPT_TOOL_NAME}`,
      toolCallId: "tool-call-interrupted",
      state: "output-error",
      input: {},
      errorText: "The user has interrupted this tool call.",
    });

    expect(
      getFlushableClientToolOutputs({
        message,
        locallyInterruptedToolCallIds: { "tool-call-interrupted": true },
      })
    ).toEqual([]);
  });

  it("ignores resolved outputs that are not client-executed", () => {
    const message = createMessage({
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: `tool-${READ_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-server",
          state: "output-available",
          input: {},
          output: "done",
        },
        {
          type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-pending",
          state: "input-available",
          input: {},
          callProviderMetadata: CLIENT_CALL_METADATA,
        },
      ],
    });

    expect(
      getFlushableClientToolOutputs({
        message,
        locallyInterruptedToolCallIds: {},
      })
    ).toEqual([]);
  });

  it("returns nothing when the message is not an assistant message", () => {
    const message = createMessage({
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });

    expect(
      getFlushableClientToolOutputs({
        message,
        locallyInterruptedToolCallIds: {},
      })
    ).toEqual([]);
  });
});

describe("shouldKeepTurnOpenForPendingToolOutput", () => {
  it("keeps the turn open while a client-side tool output is pending", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {},
          },
        ],
      }),
    ];

    expect(
      shouldKeepTurnOpenForPendingToolOutput({
        messages,
        shouldSendAutomatically: false,
      })
    ).toBe(true);
  });

  it("does not keep the turn open after completed tool output", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output: "done",
          },
        ],
      }),
    ];

    expect(
      shouldKeepTurnOpenForPendingToolOutput({
        messages,
        shouldSendAutomatically: false,
      })
    ).toBe(false);
  });
});
