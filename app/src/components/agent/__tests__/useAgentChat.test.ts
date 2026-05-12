import { USER_INTERRUPT_ERROR } from "@phoenix/agent/chat/shouldSendAutomatically";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import type { AgentChatTurn } from "@phoenix/contexts/AgentChatRuntimeContext";

import {
  createGuardedAddToolOutput,
  resolveInterruptedMessages,
  shouldSendAutomaticallyForTurn,
} from "../useAgentChat";

function createTurn(isCurrent: boolean): AgentChatTurn {
  return {
    generation: isCurrent ? 1 : 0,
    isCurrent: () => isCurrent,
  };
}

describe("createGuardedAddToolOutput", () => {
  it("does not write stale tool outputs", async () => {
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const guardedAddToolOutput = createGuardedAddToolOutput({
      addToolOutput,
      turn: createTurn(false),
    });

    await guardedAddToolOutput({
      tool: READ_PROMPT_TOOL_NAME,
      toolCallId: "tool-call-1",
      output: "late output",
    });

    expect(addToolOutput).not.toHaveBeenCalled();
  });
});

describe("shouldSendAutomaticallyForTurn", () => {
  it("does not auto-continue stale turns", () => {
    const messages: AgentUIMessage[] = [
      {
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
      },
    ];

    expect(
      shouldSendAutomaticallyForTurn({
        messages,
        turn: createTurn(false),
      })
    ).toBe(false);
  });
});

describe("resolveInterruptedMessages", () => {
  it("marks unresolved tool calls interrupted before removing tool input parts", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "actually, what is a trace" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "text", text: "A trace is", state: "streaming" },
          {
            type: `tool-${READ_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: { instanceId: 1 },
          },
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-2",
            state: "input-streaming",
            input: undefined,
          },
        ],
      },
    ];

    const result = resolveInterruptedMessages({
      messages,
      errorText: USER_INTERRUPT_ERROR,
    });

    expect(result.interruptedToolCalls).toEqual([
      { tool: READ_PROMPT_TOOL_NAME, toolCallId: "tool-call-1" },
      { tool: EDIT_PROMPT_TOOL_NAME, toolCallId: "tool-call-2" },
    ]);
    expect(result.messages.at(-1)?.parts).toEqual([
      { type: "text", text: "A trace is", state: "streaming" },
      {
        type: `tool-${READ_PROMPT_TOOL_NAME}`,
        toolCallId: "tool-call-1",
        state: "output-error",
        input: { instanceId: 1 },
        errorText: USER_INTERRUPT_ERROR,
      },
      {
        type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
        toolCallId: "tool-call-2",
        state: "output-error",
        input: {},
        errorText: USER_INTERRUPT_ERROR,
      },
    ]);
  });
});
