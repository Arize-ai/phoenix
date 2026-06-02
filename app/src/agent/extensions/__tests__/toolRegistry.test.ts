import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  getAgentToolUIBehavior,
  handleRegisteredAgentToolCall,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  SET_TIME_RANGE_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/extensions/toolRegistry";
import {
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundModel";
import { READ_PLAYGROUND_OUTPUT_TOOL_NAME } from "@phoenix/agent/tools/playgroundOutput";
import {
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import { RUN_PLAYGROUND_TOOL_NAME } from "@phoenix/agent/tools/playgroundRun";
import {
  createSavePromptClientAction,
  SAVE_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import { SET_VARIABLE_VALUES_TOOL_NAME } from "@phoenix/agent/tools/playgroundVariableValues";
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

  it("returns an error when open_code_evaluator_form has no mounted action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-open-evaluator-form-missing",
        toolName: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
        toolCallId: "tool-call-open-evaluator-form-missing",
        errorText:
          "The dataset-backed playground is not mounted; cannot open the evaluator form.",
      })
    );
  });

  it("returns an error when open_llm_evaluator_form has no mounted action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-open-llm-evaluator-form-missing",
        toolName: OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
        toolCallId: "tool-call-open-llm-evaluator-form-missing",
        errorText:
          "The dataset-backed playground is not mounted; cannot open the evaluator form.",
      })
    );
  });

  it("returns an error when test_code_evaluator_draft has no mounted action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-code-evaluator-test-missing",
        toolName: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: "tool-call-code-evaluator-test-missing",
        errorText:
          "The code-evaluator test section is not mounted; cannot test the draft.",
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

  it("dispatches run_playground to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({ ok: true, output: "started" });
    store.getState().registerClientAction(RUN_PLAYGROUND_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-run-playground",
        toolName: RUN_PLAYGROUND_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith({});
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: RUN_PLAYGROUND_TOOL_NAME,
        output: "started",
      })
    );
  });

  it("dispatches read_playground_output to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, output: "playground output" });
    store
      .getState()
      .registerClientAction(READ_PLAYGROUND_OUTPUT_TOOL_NAME, action);

    const input = { instanceId: 0, repetitionNumber: 1 };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-read-playground-output",
        toolName: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
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
        tool: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
        output: "playground output",
      })
    );
  });

  it("dispatches set_variable_values to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({ ok: true, output: "updated" });
    store
      .getState()
      .registerClientAction(SET_VARIABLE_VALUES_TOOL_NAME, action);

    const input = { values: [{ key: "question", value: "What is Phoenix?" }] };

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-variable-values",
        toolName: SET_VARIABLE_VALUES_TOOL_NAME,
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
        tool: SET_VARIABLE_VALUES_TOOL_NAME,
        output: "updated",
      })
    );
  });

  it("dispatches set_playground_model to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({
      ok: true,
      output: "model updated",
    });
    store
      .getState()
      .registerClientAction(SET_PLAYGROUND_MODEL_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-set-playground-model",
        toolName: SET_PLAYGROUND_MODEL_TOOL_NAME,
        input: {
          instanceId: 0,
          target: {
            type: "builtin",
            provider: "OPENAI",
            modelName: "gpt-5",
          },
        },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith({
      instanceId: 0,
      target: {
        type: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5",
      },
    });
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SET_PLAYGROUND_MODEL_TOOL_NAME,
        output: "model updated",
      })
    );
  });

  it("dispatches list_playground_model_targets to the registered client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({
      ok: true,
      output: "model targets",
    });
    store
      .getState()
      .registerClientAction(LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-list-model-targets",
        toolName: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(action).toHaveBeenCalledWith({});
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
        output: "model targets",
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

  it("declares edit_prompt_instance as an auto-focused tool", () => {
    expect(getAgentToolUIBehavior(EDIT_PROMPT_TOOL_NAME)).toEqual({
      autoOpen: true,
      scrollIntoViewOnMount: true,
    });
    expect(getAgentToolUIBehavior(SAVE_PROMPT_TOOL_NAME)).toEqual({
      autoOpen: true,
      scrollIntoViewOnMount: true,
    });
  });
});
