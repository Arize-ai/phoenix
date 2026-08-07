import type { UIMessage } from "ai";

import {
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

const CLIENT_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "client" },
};

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

describe("shouldSendAutomaticallyAfterToolOutput with partial outputs", () => {
  const partiallyResolvedMessages = [
    createMessage({
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: `tool-${READ_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-1",
          state: "output-available",
          input: {},
          output: { status: "accepted" },
          callProviderMetadata: CLIENT_EXECUTION_METADATA,
        },
        {
          type: `tool-${READ_PROMPT_TOOL_NAME}`,
          toolCallId: "tool-call-2",
          state: "input-available",
          input: {},
          callProviderMetadata: CLIENT_EXECUTION_METADATA,
        },
      ],
    }),
  ];

  it("flushes a newly resolved output while sibling calls are pending", () => {
    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages: partiallyResolvedMessages,
        isToolOutputSubmitted: () => false,
      })
    ).toBe(true);
  });

  it("does not re-flush outputs the server already persisted", () => {
    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages: partiallyResolvedMessages,
        isToolOutputSubmitted: (toolCallId) => toolCallId === "tool-call-1",
      })
    ).toBe(false);
  });

  it("does not flush partial outputs without submission tracking", () => {
    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages: partiallyResolvedMessages,
      })
    ).toBe(false);
  });

  it("ignores resolved server-executed tool calls", () => {
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
            providerExecuted: true,
          },
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "input-available",
            input: {},
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        isToolOutputSubmitted: () => false,
      })
    ).toBe(false);
  });

  it("keeps user-interrupt suppression ahead of partial flushes", () => {
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
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          },
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "input-available",
            input: {},
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          },
        ],
      }),
    ];

    expect(
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        isToolOutputSubmitted: () => false,
      })
    ).toBe(false);
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
