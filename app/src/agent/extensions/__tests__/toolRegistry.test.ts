import {
  getAgentToolUIBehavior,
  handleRegisteredAgentToolCall,
  SET_TIME_RANGE_TOOL_NAME,
} from "@phoenix/agent/extensions/toolRegistry";
import {
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
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

  it("ignores server-executed tools advertised by the chat stream", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-server",
        toolName: "query_docs_filesystem_phoenix",
        input: { command: 'rg -il "datasets" /' },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
      serverExecutedToolNames: new Set(["query_docs_filesystem_phoenix"]),
    });

    expect(addToolOutput).not.toHaveBeenCalled();
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

  it("dispatches set_time_range to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({ ok: true, output: "updated" });
    store.getState().registerClientAction(SET_TIME_RANGE_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-5",
        toolName: SET_TIME_RANGE_TOOL_NAME,
        input: { timeRangeKey: "1h" },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith({ timeRangeKey: "1h" });
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SET_TIME_RANGE_TOOL_NAME,
        output: "updated",
      })
    );
  });

  it("dispatches clone_prompt_instance to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({ ok: true, output: "cloned" });
    store
      .getState()
      .registerClientAction(CLONE_PROMPT_INSTANCE_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-6",
        toolName: CLONE_PROMPT_INSTANCE_TOOL_NAME,
        input: { instanceId: 0 },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith({ instanceId: 0 });
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: CLONE_PROMPT_INSTANCE_TOOL_NAME,
        output: "cloned",
      })
    );
  });

  it("declares edit_prompt_instance as an auto-focused tool", () => {
    expect(getAgentToolUIBehavior(EDIT_PROMPT_TOOL_NAME)).toEqual({
      autoOpen: true,
      scrollIntoViewOnMount: true,
    });
  });
});
