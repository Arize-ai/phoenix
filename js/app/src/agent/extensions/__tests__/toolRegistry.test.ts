import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { handleRegisteredAgentToolCall } from "@phoenix/agent/extensions/toolRegistry";
import { GENERATIVE_UI_TOOL_NAME } from "@phoenix/components/agent/generativeUICatalog";
import { createAgentStore } from "@phoenix/store/agentStore";

installTestStorage();

describe("toolRegistry", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
  });

  it("skips server-executed tools without producing output", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-server-1",
        toolName: "search_docs",
        input: { query: "phoenix" },
        providerMetadata: {
          phoenix: { toolExecutionEnvironment: "server" },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).not.toHaveBeenCalled();
  });

  it("skips server-executed tools even when the name matches a client tool", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-server-2",
        toolName: "ask_user",
        input: {
          questions: [{ id: "q-1", prompt: "Prompt", type: "freeform" }],
        },
        providerMetadata: {
          phoenix: { toolExecutionEnvironment: "server" },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
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

  it("resolves generative UI tool calls without mutating message parts", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const appendMessagePart = vi.fn();
    const spec = {
      root: "chart",
      elements: {
        chart: {
          type: "BarChart",
          props: {
            title: "Trace Summary",
            data: [
              { label: "Total spans", value: 42 },
              { label: "Error spans", value: 3 },
            ],
          },
          children: [],
        },
      },
    };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-7",
        toolName: GENERATIVE_UI_TOOL_NAME,
        input: { spec },
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart,
      agentStore: store,
    });

    expect(appendMessagePart).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: GENERATIVE_UI_TOOL_NAME,
      })
    );
  });

  it("fails generative UI tool calls with invalid render specs", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const appendMessagePart = vi.fn();

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-8",
        toolName: GENERATIVE_UI_TOOL_NAME,
        input: {
          spec: {
            root: "chart",
            elements: {
              chart: {
                type: "LineChart",
                props: { title: null, data: null },
                children: [],
              },
            },
          },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart,
      agentStore: store,
    });

    expect(appendMessagePart).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: GENERATIVE_UI_TOOL_NAME,
        toolCallId: "tool-call-8",
        errorText: "Request should adhere to chart requirements.",
      })
    );
  });

  it("adds chart guidance for generative UI count violations", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const appendMessagePart = vi.fn();

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-8b",
        toolName: GENERATIVE_UI_TOOL_NAME,
        input: {
          spec: {
            root: "chart",
            elements: {
              chart: {
                type: "VerticalBarChart",
                props: {
                  title: "Traces Per Day",
                  data: Array.from({ length: 31 }, (_, index) => ({
                    label: `Day ${index + 1}`,
                    value: index,
                  })),
                },
                children: [],
              },
            },
          },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart,
      agentStore: store,
    });

    expect(appendMessagePart).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: GENERATIVE_UI_TOOL_NAME,
        toolCallId: "tool-call-8b",
        errorText: "Request should adhere to chart requirements.",
      })
    );
  });

  it("fails malformed stacked bar chart specs before rendering", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const appendMessagePart = vi.fn();

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-malformed-stacked",
        toolName: GENERATIVE_UI_TOOL_NAME,
        input: {
          spec: {
            root: "stacked",
            elements: {
              stacked: {
                type: "StackedBarChart",
                props: {
                  title: "Stacked Bar Chart — Token Usage by Model",
                  data: [
                    {
                      label: "gpt-4o",
                      segments: [
                        { label: "Prompt", value: 12500 },
                        { label: "Completion", value: 8200 },
                        {},
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart,
      agentStore: store,
    });

    expect(appendMessagePart).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: GENERATIVE_UI_TOOL_NAME,
        toolCallId: "tool-call-malformed-stacked",
        errorText: "Request should adhere to chart requirements.",
      })
    );
  });

  it("accepts generative UI specs that omit optional props", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const appendMessagePart = vi.fn();
    const spec = {
      root: "line",
      elements: {
        line: {
          type: "LineChart",
          props: {
            title: "Daily error count",
            lines: [{ label: "Errors", data: [0, 0, 1, 0] }],
            xLabels: ["May 10", "May 11", "May 12", "May 13"],
          },
          children: [],
        },
      },
    };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-9",
        toolName: GENERATIVE_UI_TOOL_NAME,
        input: { spec, state: {} },
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart,
      agentStore: store,
    });

    expect(appendMessagePart).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: GENERATIVE_UI_TOOL_NAME,
      })
    );
  });
});
