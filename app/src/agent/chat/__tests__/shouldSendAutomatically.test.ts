import type { UIMessage } from "ai";

import {
  shouldSendAutomaticallyAfterToolOutput,
  SYSTEM_INTERRUPT_ERROR,
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

  it("does not continue after system-interrupted tool errors", () => {
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
            errorText: SYSTEM_INTERRUPT_ERROR,
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
