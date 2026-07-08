import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { createAgentToolDispatcher } from "@phoenix/agent/extensions/registry/dispatch";
import {
  getAgentToolUIBehavior,
  handleRegisteredAgentToolCall,
} from "@phoenix/agent/extensions/toolRegistry";
import { BASH_TOOL_NAME } from "@phoenix/agent/tools/bash";
import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME } from "@phoenix/agent/tools/datasetEvaluatorDefinition";
import { OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME } from "@phoenix/agent/tools/datasetEvaluatorForEdit";
import { SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME } from "@phoenix/agent/tools/datasetEvaluatorSelection";
import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import { GET_ROUTE_INFO_TOOL_NAME } from "@phoenix/agent/tools/getRouteInfo";
import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import { PATCH_EXPERIMENT_TOOL_NAME } from "@phoenix/agent/tools/patchExperiment";
import { SET_APPENDED_MESSAGES_PATH_TOOL_NAME } from "@phoenix/agent/tools/playgroundAppendedMessagesPath";
import { SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME } from "@phoenix/agent/tools/playgroundExperimentRecording";
import { LOAD_DATASET_TOOL_NAME } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundModel";
import { READ_PLAYGROUND_OUTPUT_TOOL_NAME } from "@phoenix/agent/tools/playgroundOutput";
import {
  ADD_PROMPT_INSTANCE_TOOL_NAME,
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { SET_PLAYGROUND_REPETITIONS_TOOL_NAME } from "@phoenix/agent/tools/playgroundRepetitions";
import {
  CANCEL_PLAYGROUND_RUN_TOOL_NAME,
  RUN_PLAYGROUND_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundRun";
import { SAVE_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundSavePrompt";
import { SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME } from "@phoenix/agent/tools/playgroundTemplateVariablesPath";
import { SET_VARIABLE_VALUES_TOOL_NAME } from "@phoenix/agent/tools/playgroundVariableValues";
import { SET_SESSIONS_FILTER_TOOL_NAME } from "@phoenix/agent/tools/sessionsFilter";
import { SET_SPANS_FILTER_TOOL_NAME } from "@phoenix/agent/tools/spansFilter";
import { SET_TIME_RANGE_TOOL_NAME } from "@phoenix/agent/tools/timeRange";
import { GENERATIVE_UI_TOOL_NAME } from "@phoenix/components/agent/generativeUICatalog";
import { createAgentStore } from "@phoenix/store/agentStore";

installTestStorage();

/**
 * Every frontend-executable PXI tool the registry is expected to dispatch,
 * keyed by its server-advertised name constant. Sourced from each tool module
 * so the test asserts against the same constants the registry and the
 * client-action registrations both consume — a rename that desynchronizes
 * the registry from a tool module breaks this list at compile time.
 */
const EXPECTED_TOOL_NAMES = [
  BASH_TOOL_NAME,
  GET_ROUTE_INFO_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  SET_TIME_RANGE_TOOL_NAME,
  GENERATIVE_UI_TOOL_NAME,
  SET_SPANS_FILTER_TOOL_NAME,
  SET_SESSIONS_FILTER_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  ADD_PROMPT_INSTANCE_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
  SAVE_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  LOAD_DATASET_TOOL_NAME,
  RUN_PLAYGROUND_TOOL_NAME,
  CANCEL_PLAYGROUND_RUN_TOOL_NAME,
  READ_PLAYGROUND_OUTPUT_TOOL_NAME,
  SET_VARIABLE_VALUES_TOOL_NAME,
  SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
  SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
  SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME,
  SET_APPENDED_MESSAGES_PATH_TOOL_NAME,
  SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME,
  OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME,
  READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME,
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  PATCH_EXPERIMENT_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
] as const;

/**
 * Tools whose `parseInput` accepts an empty payload, so dispatching them with
 * `{}` and no registered client action deterministically reaches the
 * "not mounted" branch. Used to assert the registry routes each canonical name
 * to a client-action lookup keyed by that same name.
 */
const EMPTY_INPUT_CLIENT_ACTION_TOOL_NAMES = [
  READ_PROMPT_TOOL_NAME,
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  ADD_PROMPT_INSTANCE_TOOL_NAME,
  READ_PROMPT_TOOLS_TOOL_NAME,
  RUN_PLAYGROUND_TOOL_NAME,
  CANCEL_PLAYGROUND_RUN_TOOL_NAME,
  READ_PLAYGROUND_OUTPUT_TOOL_NAME,
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
] as const;

/** Tools that declare auto-focus UI behavior (autoOpen + scroll into view). */
const AUTO_FOCUS_TOOL_NAMES = [
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
  SAVE_PROMPT_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
  LOAD_DATASET_TOOL_NAME,
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  PATCH_EXPERIMENT_TOOL_NAME,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
] as const;

describe("registry contract", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
  });

  it("ensures the unknown-tool guard fires for an unregistered name", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "unknown-1",
        toolName: "definitely-not-a-real-tool",
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore: store,
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        errorText: "Unknown tool: definitely-not-a-real-tool",
      })
    );
  });

  it.each(EXPECTED_TOOL_NAMES)(
    "registers %s so dispatch never reports an unknown tool",
    async (toolName) => {
      const store = createAgentStore();
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      await handleRegisteredAgentToolCall({
        toolCall: { toolCallId: `call-${toolName}`, toolName, input: {} },
        sessionId: "session-1",
        addToolOutput,
        agentStore: store,
      });

      // A registered tool may still surface an invalid-input or not-mounted
      // error for the empty payload, but it must never fall through to the
      // unknown-tool guard.
      expect(addToolOutput).not.toHaveBeenCalledWith(
        expect.objectContaining({
          errorText: `Unknown tool: ${toolName}`,
        })
      );
    }
  );

  it.each(EMPTY_INPUT_CLIENT_ACTION_TOOL_NAMES)(
    "routes %s to a client-action lookup keyed by its own name",
    async (toolName) => {
      const store = createAgentStore();
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      // No client action is registered, so the lookup keyed by `toolName`
      // misses and the tool surfaces its "not mounted" error. This proves the
      // registry dispatches the canonical name to the client-action seam.
      await handleRegisteredAgentToolCall({
        toolCall: { toolCallId: `call-${toolName}`, toolName, input: {} },
        sessionId: "session-1",
        addToolOutput,
        agentStore: store,
      });

      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "output-error",
          tool: toolName,
          errorText: expect.stringContaining("not mounted"),
        })
      );
    }
  );

  it("invokes a registered client action and maps its result to output", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({ ok: true, output: "did it" });
    store.getState().registerClientAction(RUN_PLAYGROUND_TOOL_NAME, action);

    await handleRegisteredAgentToolCall({
      toolCall: {
        toolCallId: "call-run",
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
        output: "did it",
      })
    );
  });

  it.each(AUTO_FOCUS_TOOL_NAMES)(
    "declares %s as an auto-focused tool",
    (toolName) => {
      expect(getAgentToolUIBehavior(toolName)).toEqual({
        autoOpen: true,
        scrollIntoViewOnMount: true,
      });
    }
  );

  it("does not declare UI behavior for non-auto-focus tools", () => {
    expect(getAgentToolUIBehavior(READ_PROMPT_TOOL_NAME)).toBeUndefined();
    expect(getAgentToolUIBehavior(RUN_PLAYGROUND_TOOL_NAME)).toBeUndefined();
    expect(getAgentToolUIBehavior("not-a-tool")).toBeUndefined();
  });

  it("throws when two tools are registered under the same name", () => {
    const makeStubTool = () =>
      defineTool<unknown>({
        name: "duplicate-name",
        parseInput: (input) => input,
        invalidInputErrorText: "invalid",
        execute: async () => {},
      });

    expect(() =>
      createAgentToolDispatcher([makeStubTool(), makeStubTool()])
    ).toThrow(/Duplicate agent tool name/);
  });
});
