import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { handleRegisteredAgentToolCall } from "@phoenix/agent/extensions/toolRegistry";
import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME } from "@phoenix/agent/tools/playgroundExperimentRecording";
import { SET_PLAYGROUND_REPETITIONS_TOOL_NAME } from "@phoenix/agent/tools/playgroundRepetitions";
import {
  createSavePromptClientAction,
  SAVE_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import { GENERATIVE_UI_TOOL_NAME } from "@phoenix/components/agent/generativeUICatalog";
import { createAgentStore } from "@phoenix/store/agentStore";
import { createPlaygroundStore } from "@phoenix/store/playground";

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
          phoenix: { tool_execution_environment: "server" },
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
          phoenix: { tool_execution_environment: "server" },
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

  it("tells the agent how to recover from an empty batch span annotation call", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-empty-batch-annotation",
        toolName: BATCH_SPAN_ANNOTATE_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: BATCH_SPAN_ANNOTATE_TOOL_NAME,
        toolCallId: "tool-call-empty-batch-annotation",
        errorText: expect.stringContaining("needs an annotations array"),
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

  it("requires approval before dispatching save_prompt to the registered client action", async () => {
    const store = createAgentStore();
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const savePrompt = vi.fn().mockResolvedValue({
      ok: true,
      output: { status: "saved", promptId: "prompt-id" },
    });
    const action = createSavePromptClientAction({
      playgroundStore,
      setPendingSavePrompt: store.getState().setPendingSavePrompt,
      savePrompt,
    });
    store.getState().registerClientAction(SAVE_PROMPT_TOOL_NAME, action);

    const input = { description: "Improve instructions" };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-save-prompt",
        toolName: SAVE_PROMPT_TOOL_NAME,
        input,
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(savePrompt).not.toHaveBeenCalled();
    expect(addToolOutput).not.toHaveBeenCalled();
    const pendingSave =
      store.getState().pendingSavePromptsByToolCallId["tool-call-save-prompt"];
    expect(pendingSave).toEqual(
      expect.objectContaining({
        toolCallId: "tool-call-save-prompt",
        sessionId: "session-1",
        input,
        preview: expect.objectContaining({
          description: "Improve instructions",
          tags: [],
        }),
      })
    );

    await pendingSave?.accept?.();

    expect(savePrompt).toHaveBeenCalledWith({
      playgroundStore,
      input,
    });
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SAVE_PROMPT_TOOL_NAME,
        output: expect.objectContaining({
          status: "saved",
          promptId: "prompt-id",
          approvalStatus: "accepted",
          acceptedBy: "user",
        }),
      })
    );
    expect(
      store.getState().pendingSavePromptsByToolCallId["tool-call-save-prompt"]
    ).toBeUndefined();
  });

  it("dispatches set_playground_experiment_recording to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, output: "recording updated" });
    store
      .getState()
      .registerClientAction(
        SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        action
      );

    const input = { recordExperiments: true };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-playground-experiment-recording",
        toolName: SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        input,
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith(input);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        output: "recording updated",
      })
    );
  });

  it("dispatches set_playground_repetitions to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, output: "repetitions updated" });
    store
      .getState()
      .registerClientAction(SET_PLAYGROUND_REPETITIONS_TOOL_NAME, action);

    const input = { repetitions: 4 };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-playground-repetitions",
        toolName: SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
        input,
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith(input);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
        output: "repetitions updated",
      })
    );
  });

  it("surfaces set_playground_experiment_recording client action errors", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "already running" });
    store
      .getState()
      .registerClientAction(
        SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        action
      );

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-playground-experiment-recording-error",
        toolName: SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        input: { recordExperiments: true },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
        errorText: "already running",
      })
    );
  });

  it("surfaces set_playground_repetitions client action errors", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "already running" });
    store
      .getState()
      .registerClientAction(SET_PLAYGROUND_REPETITIONS_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-playground-repetitions-error",
        toolName: SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
        input: { repetitions: 4 },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
        errorText: "already running",
      })
    );
  });

  it("auto-approves save_prompt only when edit approvals are bypassed", async () => {
    const store = createAgentStore();
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const savePrompt = vi.fn().mockResolvedValue({
      ok: true,
      output: { status: "saved", promptId: "prompt-id" },
    });
    const action = createSavePromptClientAction({
      playgroundStore,
      setPendingSavePrompt: store.getState().setPendingSavePrompt,
      shouldAutoAccept: () => store.getState().permissions.edits === "bypass",
      savePrompt,
    });
    store.getState().registerClientAction(SAVE_PROMPT_TOOL_NAME, action);
    store.getState().setPermissions({ edits: "bypass" });

    const input = { description: "Improve instructions" };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-save-prompt-bypass",
        toolName: SAVE_PROMPT_TOOL_NAME,
        input,
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(savePrompt).toHaveBeenCalledWith({
      playgroundStore,
      input,
    });
    expect(
      store.getState().pendingSavePromptsByToolCallId[
        "tool-call-save-prompt-bypass"
      ]
    ).toBeUndefined();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SAVE_PROMPT_TOOL_NAME,
        output: expect.objectContaining({
          status: "saved",
          promptId: "prompt-id",
          approvalStatus: "accepted",
          acceptedBy: "auto",
        }),
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
