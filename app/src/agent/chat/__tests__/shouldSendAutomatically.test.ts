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

  it("does not continue while a sibling client tool call still awaits feedback", () => {
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
            output: "done",
            callProviderMetadata: {
              phoenix: { toolExecutionEnvironment: "client" },
            },
          },
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "input-available",
            input: {},
            callProviderMetadata: {
              phoenix: { toolExecutionEnvironment: "client" },
            },
          },
        ],
      }),
    ];

    const shouldSendAutomatically = shouldSendAutomaticallyAfterToolOutput({
      messages,
    });

    expect(shouldSendAutomatically).toBe(false);
    // The keep-open decision must agree with the send gate: an unresolved
    // sibling both suppresses the send and holds the turn open.
    expect(
      shouldKeepTurnOpenForPendingToolOutput({
        messages,
        shouldSendAutomatically,
      })
    ).toBe(true);
  });

  it("continues once every sibling client tool call is resolved", () => {
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
            output: "done",
            callProviderMetadata: {
              phoenix: { toolExecutionEnvironment: "client" },
            },
          },
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "output-available",
            input: {},
            output: "also done",
            callProviderMetadata: {
              phoenix: { toolExecutionEnvironment: "client" },
            },
          },
        ],
      }),
    ];

    const shouldSendAutomatically = shouldSendAutomaticallyAfterToolOutput({
      messages,
    });

    expect(shouldSendAutomatically).toBe(true);
    expect(
      shouldKeepTurnOpenForPendingToolOutput({
        messages,
        shouldSendAutomatically,
      })
    ).toBe(false);
  });

  it("does not continue when the unresolved tool call precedes a later step-start", () => {
    // The AI SDK's completeness helper only inspects parts after the last
    // step-start, so an unresolved call before it is invisible to the SDK.
    // The PXI gate must still suppress the send.
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {},
            callProviderMetadata: {
              phoenix: { toolExecutionEnvironment: "client" },
            },
          },
          { type: "step-start" },
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

    const shouldSendAutomatically = shouldSendAutomaticallyAfterToolOutput({
      messages,
    });

    expect(shouldSendAutomatically).toBe(false);
    expect(
      shouldKeepTurnOpenForPendingToolOutput({
        messages,
        shouldSendAutomatically,
      })
    ).toBe(true);
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
