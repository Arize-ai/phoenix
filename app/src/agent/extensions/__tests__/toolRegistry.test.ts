import { handleRegisteredAgentToolCall } from "@phoenix/agent/extensions/toolRegistry";
import { createAgentStore } from "@phoenix/store/agentStore";

describe("toolRegistry", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
  });

  it("returns an error output for unknown tools", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-1",
        toolName: "not-a-real-tool",
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: "not-a-real-tool",
        toolCallId: "tool-call-1",
        errorText: expect.any(String),
      })
    );
  });

  it("returns an error output for invalid tool input", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-2",
        toolName: "ask_user",
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: "ask_user",
        toolCallId: "tool-call-2",
        errorText: expect.any(String),
      })
    );
  });

  it("returns an error when ask_user is invoked without an active session", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-3",
        toolName: "ask_user",
        input: {
          questions: [{ id: "question-1", prompt: "Prompt", type: "freeform" }],
        },
      },
      sessionId: null,
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: "ask_user",
        toolCallId: "tool-call-3",
        errorText: expect.any(String),
      })
    );
  });

  it("stores pending elicitation for a valid ask_user call", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-4",
        toolName: "ask_user",
        input: {
          questions: [{ id: "question-1", prompt: "Prompt", type: "freeform" }],
        },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).not.toHaveBeenCalled();
    expect(store.getState().pendingElicitationBySessionId["session-1"]).toEqual(
      expect.objectContaining({
        toolCallId: "tool-call-4",
        questions: [
          expect.objectContaining({
            id: "question-1",
            prompt: "Prompt",
            type: "freeform",
          }),
        ],
      })
    );
  });
});
