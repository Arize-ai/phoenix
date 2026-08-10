import type { UIMessage } from "ai";

import {
  getFlushableClientToolOutputs,
  shouldKeepTurnOpenForPendingToolOutput,
  shouldSendAutomaticallyAfterToolOutput,
  USER_INTERRUPT_ERROR,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import {
  EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
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

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(true);
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

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(true);
  });

  it("does not continue after user-interrupted tool errors", () => {
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
            errorText: USER_INTERRUPT_ERROR,
          },
        ],
      }),
    ];

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(false);
  });

  it("does not continue after navigation-cancelled edit_prompt_instance", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-error",
            input: {},
            errorText: EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
          },
        ],
      }),
    ];

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(false);
  });

  it("does not continue after navigation-cancelled remove_prompt_instance", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${REMOVE_PROMPT_INSTANCE_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-error",
            input: {},
            errorText: REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
          },
        ],
      }),
    ];

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(false);
  });

  it("does not continue after navigation-cancelled edit_code_evaluator_draft", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-error",
            input: {},
            errorText: EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
          },
        ],
      }),
    ];

    expect(shouldSendAutomaticallyAfterToolOutput({ messages })).toBe(false);
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
    expect(getFlushableClientToolOutputs({ message })).toEqual([]);
  });

  it("returns nothing when the tail holds a user-interrupted output", () => {
    const message = partiallyResolvedAssistantMessage();
    message.parts.push({
      type: `tool-${READ_PROMPT_TOOL_NAME}`,
      toolCallId: "tool-call-interrupted",
      state: "output-error",
      input: {},
      errorText: USER_INTERRUPT_ERROR,
    });

    expect(getFlushableClientToolOutputs({ message })).toEqual([]);
  });

  it("returns nothing when the tail holds a navigation-cancelled output", () => {
    const message = partiallyResolvedAssistantMessage();
    message.parts.push({
      type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
      toolCallId: "tool-call-cancelled",
      state: "output-error",
      input: {},
      errorText: EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
    });

    expect(getFlushableClientToolOutputs({ message })).toEqual([]);
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

    expect(getFlushableClientToolOutputs({ message })).toEqual([]);
  });

  it("returns nothing when the message is not an assistant message", () => {
    const message = createMessage({
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });

    expect(getFlushableClientToolOutputs({ message })).toEqual([]);
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
