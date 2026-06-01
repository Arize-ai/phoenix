import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 */
import { getBashToolInput } from "@phoenix/agent/tools/bash";
import type { BashToolInput } from "@phoenix/agent/tools/bash";
import { handleBashToolCall } from "@phoenix/agent/tools/bash/handleBashToolCall";
import {
  applySpanAnnotations,
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  type BatchSpanAnnotateActionContext,
  type BatchSpanAnnotateInput,
  bindPendingBatchSpanAnnotateActions,
  parseBatchSpanAnnotateInput,
} from "@phoenix/agent/tools/batchSpanAnnotate";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  parseEditCodeEvaluatorDraftInput,
  parseReadCodeEvaluatorDraftInput,
  parseTestCodeEvaluatorDraftInput,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  type EditCodeEvaluatorDraftActionContext,
  type EditCodeEvaluatorDraftInput,
  type OpenCodeEvaluatorFormInput,
  type ReadCodeEvaluatorDraftInput,
  type TestCodeEvaluatorDraftInput,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { parseElicitToolInput } from "@phoenix/agent/tools/elicit";
import type { ElicitToolInput } from "@phoenix/agent/tools/elicit";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import {
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  parseListPlaygroundModelTargetsInput,
  parseSetPlaygroundModelInput,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
  type ListPlaygroundModelTargetsInput,
  type SetPlaygroundModelInput,
} from "@phoenix/agent/tools/playgroundModel";
import {
  LOAD_DATASET_TOOL_NAME,
  parseLoadDatasetInput,
  type LoadDatasetActionContext,
  type LoadDatasetInput,
} from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  parseReadPlaygroundOutputInput,
  READ_PLAYGROUND_OUTPUT_TOOL_NAME,
  type ReadPlaygroundOutputInput,
} from "@phoenix/agent/tools/playgroundOutput";
import {
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  EDIT_PROMPT_TOOL_NAME,
  parseClonePromptInstanceInput,
  parseEditPromptInput,
  parseReadPromptInput,
  type ClonePromptInstanceInput,
  READ_PROMPT_TOOL_NAME,
  type EditPromptActionContext,
  type EditPromptInput,
  type ReadPromptInput,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  parseReadPromptToolsInput,
  parseWritePromptToolsInput,
  READ_PROMPT_TOOLS_TOOL_NAME,
  type ReadPromptToolsInput,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
  type WritePromptToolsInput,
} from "@phoenix/agent/tools/playgroundPromptTools";
import {
  parseRunPlaygroundInput,
  RUN_PLAYGROUND_TOOL_NAME,
  type RunPlaygroundInput,
} from "@phoenix/agent/tools/playgroundRun";
import {
  parseSavePromptInput,
  SAVE_PROMPT_TOOL_NAME,
  type SavePromptInput,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import {
  parseSetVariableValuesInput,
  SET_VARIABLE_VALUES_TOOL_NAME,
  type SetVariableValuesInput,
} from "@phoenix/agent/tools/playgroundVariableValues";
import type { components } from "@phoenix/api/__generated__/v1";
import {
  GENERATIVE_UI_TOOL_NAME,
  renderGenerativeUISpecSchema,
} from "@phoenix/components/agent/generativeUICatalog";
import type { TimeRangeKey } from "@phoenix/components/datetime/types";
import type { AgentStore } from "@phoenix/store/agentStore";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import {
  getAgentCapabilityDefinition,
  type AgentCapabilities,
  type AgentCapabilityKey,
} from "./capabilities";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];
type AppendMessagePart = (part: UIMessage["parts"][number]) => void;

type ToolCallProviderMetadata =
  components["schemas"]["ToolCallProviderMetadata"];

/**
 * Minimal tool-call shape produced by the AI SDK runtime.
 */
export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerMetadata?: {
    phoenix?: ToolCallProviderMetadata;
  };
};

/** Shared execution context passed to each registered tool handler. */
type AgentToolHandlerContext<TInput> = {
  toolCall: AgentToolCall;
  input: TInput;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  appendMessagePart: AppendMessagePart;
  agentStore: AgentStore;
  capabilities: AgentCapabilities;
};

/**
 * One frontend tool entry: server-advertised name, parser for raw input,
 * optional capability gates, and the implementation that handles the call.
 */
type RegisteredAgentTool<TInput> = {
  name: string;
  parseInput: (input: unknown) => TInput | null;
  invalidInputErrorText: string | ((input: unknown) => string);
  requiredCapabilities?: AgentCapabilityKey[];
  uiBehavior?: AgentToolUIBehavior;
  execute: (context: AgentToolHandlerContext<TInput>) => Promise<void>;
};

export type AgentToolUIBehavior = {
  autoOpen?: boolean;
  scrollIntoViewOnMount?: boolean;
};

// TODO(pending-tool-rehydration): Generalize pending tool rehydration here.
// Tool definitions should be able to declare how to serialize pending UI state
// and how to rebind runtime dependencies, instead of each tool owning bespoke
// Zustand slices and page-level rehydration logic.

/** Helps TypeScript preserve the input type for each tool definition. */
function createRegisteredAgentTool<TInput>(
  tool: RegisteredAgentTool<TInput>
): RegisteredAgentTool<TInput> {
  return tool;
}

/** Bash runs in the browser sandbox and is gated by runtime capabilities. */
const bashAgentTool = createRegisteredAgentTool<BashToolInput>({
  name: "bash",
  parseInput: getBashToolInput,
  invalidInputErrorText: "Invalid bash tool input",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    capabilities,
  }) => {
    await handleBashToolCall({
      toolCallId: toolCall.toolCallId,
      input,
      sessionId,
      addToolOutput,
      capabilities,
    });
  },
});

/** ask_user pauses tool execution until the user answers in the UI. */
const askUserAgentTool = createRegisteredAgentTool<ElicitToolInput>({
  name: "ask_user",
  parseInput: parseElicitToolInput,
  invalidInputErrorText:
    "Invalid ask_user tool input. Expected { questions: ElicitationQuestion[] }.",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: "ask_user",
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot ask user questions without an active session.",
      });
      return;
    }

    agentStore.getState().setPendingElicitation(sessionId, {
      toolCallId: toolCall.toolCallId,
      questions: input.questions,
    });
  },
});

/**
 * Server-advertised, client-executed: the server owns the canonical schema
 * and description (see agents/tools/set_spans_filter.py); this name is the
 * single source of truth for routing the call to the matching client action
 * registered by SpanFilterConditionField. The tool consolidates control over
 * both the freeform filter condition and the root-vs-all-spans toggle.
 */
export const SET_SPANS_FILTER_TOOL_NAME = "set_spans_filter";

export type SetSpansFilterInput = {
  condition: string;
  rootSpansOnly: boolean;
};

export const SET_TIME_RANGE_TOOL_NAME = "set_time_range";

export type SetTimeRangeInput = {
  timeRangeKey: TimeRangeKey;
  startTime?: string;
  endTime?: string;
};

export {
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
};

export type RenderGenerativeUIInput = {
  /**
   * Complete json-render flat spec describing the UI tree to render.
   * The root must identify one element in `elements`; each element declares its
   * component `type`, concrete `props`, and an empty `children` array for the
   * current chart-only catalog.
   */
  spec: Record<string, unknown>;
  /**
   * Optional initial json-render state model for specs that reference `$state`.
   * Most chart calls should put literal data directly in `spec.elements[id].props`
   * and omit this value, which the parser normalizes to an empty object.
   */
  state: Record<string, unknown>;
};

/**
 * **Drift warning:** These allowed `timeRangeKey` values must stay in sync with
 * the server-side enum in
 * `src/phoenix/server/agents/tools/external/set_time_range.py`
 * (`_SET_TIME_RANGE_PARAMETERS["properties"]["timeRangeKey"]["enum"]`) and
 * the shared TypeScript type `TimeRangeKey` in
 * `app/src/components/datetime/types.ts`.
 */
const TIME_RANGE_KEYS = ["15m", "1h", "12h", "1d", "7d", "30d", "custom"];

function isValidTimeRangeKey(value: unknown): value is TimeRangeKey {
  return typeof value === "string" && TIME_RANGE_KEYS.includes(value);
}

const setTimeRangeInvalidInputErrorText = `Invalid ${SET_TIME_RANGE_TOOL_NAME} input. Expected { timeRangeKey: ${TIME_RANGE_KEYS.map((key) => `"${key}"`).join(" | ")}, startTime?: string, endTime?: string }.`;

/** Parse the server-provided span filter tool payload into the client action shape. */
function parseSetSpansFilterInput(input: unknown): SetSpansFilterInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    condition?: unknown;
    rootSpansOnly?: unknown;
  };
  if (typeof candidate.condition !== "string") return null;
  if (typeof candidate.rootSpansOnly !== "boolean") return null;
  return {
    condition: candidate.condition,
    rootSpansOnly: candidate.rootSpansOnly,
  };
}

const setSpansFilterAgentTool = createRegisteredAgentTool<SetSpansFilterInput>({
  name: SET_SPANS_FILTER_TOOL_NAME,
  parseInput: parseSetSpansFilterInput,
  invalidInputErrorText: `Invalid ${SET_SPANS_FILTER_TOOL_NAME} input. Expected { condition: string, rootSpansOnly: boolean }.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[SET_SPANS_FILTER_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The span filter field is not mounted on this page; cannot update the spans filter.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Spans filter updated.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

/** Parse and validate the set_time_range tool input. */
function parseSetTimeRangeInput(input: unknown): SetTimeRangeInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    timeRangeKey?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };
  if (!isValidTimeRangeKey(candidate.timeRangeKey)) {
    return null;
  }
  if (
    candidate.startTime !== undefined &&
    typeof candidate.startTime !== "string"
  ) {
    return null;
  }
  if (
    candidate.endTime !== undefined &&
    typeof candidate.endTime !== "string"
  ) {
    return null;
  }
  return {
    timeRangeKey: candidate.timeRangeKey,
    ...(candidate.startTime !== undefined
      ? { startTime: candidate.startTime }
      : {}),
    ...(candidate.endTime !== undefined ? { endTime: candidate.endTime } : {}),
  };
}

const setTimeRangeAgentTool = createRegisteredAgentTool<SetTimeRangeInput>({
  name: SET_TIME_RANGE_TOOL_NAME,
  parseInput: parseSetTimeRangeInput,
  invalidInputErrorText: setTimeRangeInvalidInputErrorText,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[SET_TIME_RANGE_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The app time range selector is not mounted on this page; cannot update the time range.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Time range updated.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

/** Parse and validate the render_generative_ui tool input. */
function parseRenderGenerativeUIInput(
  input: unknown
): RenderGenerativeUIInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { spec?: unknown; state?: unknown };
  const specResult = renderGenerativeUISpecSchema.safeParse(candidate.spec);
  if (!specResult.success) {
    return null;
  }
  if (candidate.state !== undefined && !isPlainObject(candidate.state)) {
    return null;
  }
  return {
    spec: specResult.data,
    state: candidate.state ?? {},
  };
}

/**
 * Maps generative UI schema failures to a user-facing tool error message.
 * Keeps chart cardinality failures specific while collapsing other schema
 * errors into a generic render failure.
 */
function getRenderGenerativeUIInvalidInputErrorText(input: unknown): string {
  const defaultErrorText = "I couldn't render that generative UI.";

  if (typeof input !== "object" || input === null) {
    return defaultErrorText;
  }

  const candidate = input as { spec?: unknown };
  const specResult = renderGenerativeUISpecSchema.safeParse(candidate.spec);
  if (specResult.success) {
    return defaultErrorText;
  }

  const hasChartRequirementIssue = specResult.error.issues.some((issue) => {
    return issue.path.some(
      (segment) =>
        segment === "data" || segment === "segments" || segment === "lines"
    );
  });

  return hasChartRequirementIssue
    ? `Request should adhere to chart requirements.`
    : defaultErrorText;
}

const renderGenerativeUIAgentTool =
  createRegisteredAgentTool<RenderGenerativeUIInput>({
    name: GENERATIVE_UI_TOOL_NAME,
    parseInput: parseRenderGenerativeUIInput,
    invalidInputErrorText: getRenderGenerativeUIInvalidInputErrorText,
    execute: async ({ toolCall, addToolOutput }) => {
      await addToolOutput({
        state: "output-available",
        tool: GENERATIVE_UI_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: "Generative UI rendered in chat.",
      });
    },
  });

const readPromptAgentTool = createRegisteredAgentTool<ReadPromptInput>({
  name: READ_PROMPT_TOOL_NAME,
  parseInput: parseReadPromptInput,
  invalidInputErrorText: `Invalid ${READ_PROMPT_TOOL_NAME} input. Expected { instanceId?: number }.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[READ_PROMPT_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: READ_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The playground prompt editor is not mounted; cannot read prompts.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: READ_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Prompt read.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: READ_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

const clonePromptInstanceAgentTool =
  createRegisteredAgentTool<ClonePromptInstanceInput>({
    name: CLONE_PROMPT_INSTANCE_TOOL_NAME,
    parseInput: parseClonePromptInstanceInput,
    invalidInputErrorText: `Invalid ${CLONE_PROMPT_INSTANCE_TOOL_NAME} input. Expected { instanceId?: number }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          CLONE_PROMPT_INSTANCE_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: CLONE_PROMPT_INSTANCE_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground prompt editor is not mounted; cannot clone prompt instances.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: CLONE_PROMPT_INSTANCE_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Prompt instance cloned.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: CLONE_PROMPT_INSTANCE_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const setPlaygroundModelAgentTool =
  createRegisteredAgentTool<SetPlaygroundModelInput>({
    name: SET_PLAYGROUND_MODEL_TOOL_NAME,
    parseInput: parseSetPlaygroundModelInput,
    invalidInputErrorText: `Invalid ${SET_PLAYGROUND_MODEL_TOOL_NAME} input. Expected { instanceId?: number, target: { type: "builtin", provider: string, modelName: string } | { type: "custom", customProviderId: string, modelName: string } }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          SET_PLAYGROUND_MODEL_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: SET_PLAYGROUND_MODEL_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground model selector is not mounted; cannot switch models.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: SET_PLAYGROUND_MODEL_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Playground model updated.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: SET_PLAYGROUND_MODEL_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const listPlaygroundModelTargetsAgentTool =
  createRegisteredAgentTool<ListPlaygroundModelTargetsInput>({
    name: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
    parseInput: parseListPlaygroundModelTargetsInput,
    invalidInputErrorText: `Invalid ${LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME} input. Expected {}.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground model selector is not mounted; cannot list available models.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Playground model targets listed.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const editPromptAgentTool = createRegisteredAgentTool<EditPromptInput>({
  name: EDIT_PROMPT_TOOL_NAME,
  parseInput: parseEditPromptInput,
  invalidInputErrorText: `Invalid ${EDIT_PROMPT_TOOL_NAME} input. Expected { instanceId: number, expectedRevision: string, operations: EditPromptOperation[] }.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const action =
      agentStore.getState().registeredClientActions[EDIT_PROMPT_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The playground prompt editor is not mounted; cannot edit prompts.",
      });
      return;
    }
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot propose prompt edits without an active session.",
      });
      return;
    }
    const context: EditPromptActionContext = {
      toolCallId: toolCall.toolCallId,
      sessionId,
      addToolOutput,
    };
    const result = await action(input, context);
    if (!result.ok) {
      await addToolOutput({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

const savePromptAgentTool = createRegisteredAgentTool<SavePromptInput>({
  name: SAVE_PROMPT_TOOL_NAME,
  parseInput: parseSavePromptInput,
  invalidInputErrorText: `Invalid ${SAVE_PROMPT_TOOL_NAME} input. Expected { description: string, instanceId?: number, promptId?: string, name?: string, tags?: string[] }.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const action =
      agentStore.getState().registeredClientActions[SAVE_PROMPT_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The playground prompt editor is not mounted; cannot save prompts.",
      });
      return;
    }
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot save prompts without an active session.",
      });
      return;
    }
    const result = await action(input, {
      toolCallId: toolCall.toolCallId,
      sessionId,
      addToolOutput,
    });
    if (!result.ok) {
      await addToolOutput({
        state: "output-error",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

const loadDatasetAgentTool = createRegisteredAgentTool<LoadDatasetInput>({
  name: LOAD_DATASET_TOOL_NAME,
  parseInput: parseLoadDatasetInput,
  invalidInputErrorText: `Invalid ${LOAD_DATASET_TOOL_NAME} input. Expected { datasetName: string, splitName?: string }.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const action =
      agentStore.getState().registeredClientActions[LOAD_DATASET_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The playground is not mounted; cannot load a dataset into the playground.",
      });
      return;
    }
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot load a dataset without an active session.",
      });
      return;
    }
    const context: LoadDatasetActionContext = {
      toolCallId: toolCall.toolCallId,
      sessionId,
      addToolOutput,
    };
    const result = await action(input, context);
    if (!result.ok) {
      await addToolOutput({
        state: "output-error",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

const runPlaygroundAgentTool = createRegisteredAgentTool<RunPlaygroundInput>({
  name: RUN_PLAYGROUND_TOOL_NAME,
  parseInput: parseRunPlaygroundInput,
  invalidInputErrorText: `Invalid ${RUN_PLAYGROUND_TOOL_NAME} input. Expected {}.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[RUN_PLAYGROUND_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: RUN_PLAYGROUND_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: "The playground is not mounted; cannot run the playground.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: RUN_PLAYGROUND_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Playground run started.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: RUN_PLAYGROUND_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

const readPlaygroundOutputAgentTool =
  createRegisteredAgentTool<ReadPlaygroundOutputInput>({
    name: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
    parseInput: parseReadPlaygroundOutputInput,
    invalidInputErrorText: `Invalid ${READ_PLAYGROUND_OUTPUT_TOOL_NAME} input. Expected { instanceId?: number, repetitionNumber?: number }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          READ_PLAYGROUND_OUTPUT_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground is not mounted; cannot read playground output.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Playground output read.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const setVariableValuesAgentTool =
  createRegisteredAgentTool<SetVariableValuesInput>({
    name: SET_VARIABLE_VALUES_TOOL_NAME,
    parseInput: parseSetVariableValuesInput,
    invalidInputErrorText: `Invalid ${SET_VARIABLE_VALUES_TOOL_NAME} input. Expected { values: { key: string, value: string }[] }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          SET_VARIABLE_VALUES_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: SET_VARIABLE_VALUES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground is not mounted; cannot set playground variable values.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: SET_VARIABLE_VALUES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Playground variable values updated.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: SET_VARIABLE_VALUES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const batchSpanAnnotateAgentTool =
  createRegisteredAgentTool<BatchSpanAnnotateInput>({
    name: BATCH_SPAN_ANNOTATE_TOOL_NAME,
    parseInput: parseBatchSpanAnnotateInput,
    invalidInputErrorText: `Invalid ${BATCH_SPAN_ANNOTATE_TOOL_NAME} input. Expected { annotations: { spanId?: string, spanNodeId?: string, name: string, annotatorKind?: "LLM" | "HUMAN" | "CODE", label?: string | null, score?: number | null, explanation?: string | null, identifier?: string | null, metadata?: object | null }[] }. Each annotation requires exactly one of spanId or spanNodeId, a non-reserved name, and at least one of label, score, or explanation.`,
    uiBehavior: {
      autoOpen: true,
      scrollIntoViewOnMount: true,
    },
    execute: async ({
      toolCall,
      input,
      sessionId,
      addToolOutput,
      agentStore,
    }) => {
      if (!sessionId) {
        await addToolOutput({
          state: "output-error",
          tool: BATCH_SPAN_ANNOTATE_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "Cannot propose span annotations without an active session.",
        });
        return;
      }
      const context: BatchSpanAnnotateActionContext = {
        toolCallId: toolCall.toolCallId,
        sessionId,
        addToolOutput,
      };
      const pendingAnnotation = bindPendingBatchSpanAnnotateActions({
        pendingAnnotation: {
          toolCallId: context.toolCallId,
          sessionId: context.sessionId,
          annotations: input,
        },
        applyAnnotations: applySpanAnnotations,
        addToolOutput: context.addToolOutput,
        setPendingBatchSpanAnnotate:
          agentStore.getState().setPendingBatchSpanAnnotate,
      });

      if (agentStore.getState().permissions.edits === "bypass") {
        await pendingAnnotation.accept?.({ approvalSource: "auto" });
        return;
      }

      agentStore
        .getState()
        .setPendingBatchSpanAnnotate(toolCall.toolCallId, pendingAnnotation);
    },
  });

const readPromptToolsAgentTool =
  createRegisteredAgentTool<ReadPromptToolsInput>({
    name: READ_PROMPT_TOOLS_TOOL_NAME,
    parseInput: parseReadPromptToolsInput,
    invalidInputErrorText: `Invalid ${READ_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId?: number }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          READ_PROMPT_TOOLS_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: READ_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: "The playground is not mounted; cannot read prompt tools.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: READ_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Prompt tools read.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: READ_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

const writePromptToolsAgentTool =
  createRegisteredAgentTool<WritePromptToolsInput>({
    name: WRITE_PROMPT_TOOLS_TOOL_NAME,
    parseInput: parseWritePromptToolsInput,
    invalidInputErrorText: `Invalid ${WRITE_PROMPT_TOOLS_TOOL_NAME} input. Expected { instanceId: number, expectedRevision: string, tools?: Array<{ id?: number | null, name: string, description?: string | null, parameters?: object | null, strict?: boolean | null }>, deleteToolIds?: number[] } with at least one tool to write or delete.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          WRITE_PROMPT_TOOLS_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The playground is not mounted; cannot write prompt tools.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Prompt tools written.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

/** Reads the current code-evaluator draft from the mounted form. */
const readCodeEvaluatorDraftAgentTool =
  createRegisteredAgentTool<ReadCodeEvaluatorDraftInput>({
    name: READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseReadCodeEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${READ_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          READ_CODE_EVALUATOR_DRAFT_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The code-evaluator form is not mounted; cannot read the draft.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Code-evaluator draft read.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

/**
 * Proposes edits to the mounted code-evaluator draft as a pending change the
 * user accepts or rejects; requires an active session to attribute the edit.
 */
const editCodeEvaluatorDraftAgentTool =
  createRegisteredAgentTool<EditCodeEvaluatorDraftInput>({
    name: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseEditCodeEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected { operations: EditCodeEvaluatorDraftOperation[] }.`,
    uiBehavior: {
      autoOpen: true,
      scrollIntoViewOnMount: true,
    },
    execute: async ({
      toolCall,
      input,
      sessionId,
      addToolOutput,
      agentStore,
    }) => {
      const action =
        agentStore.getState().registeredClientActions[
          EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The code-evaluator form is not mounted; cannot edit the draft.",
        });
        return;
      }
      if (!sessionId) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "Cannot propose code-evaluator draft edits without an active session.",
        });
        return;
      }
      const context: EditCodeEvaluatorDraftActionContext = {
        toolCallId: toolCall.toolCallId,
        sessionId,
        addToolOutput,
      };
      const result = await action(input, context);
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

/** Opens the code-evaluator form in the mounted dataset-backed playground. */
const openCodeEvaluatorFormAgentTool =
  createRegisteredAgentTool<OpenCodeEvaluatorFormInput>({
    name: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${OPEN_CODE_EVALUATOR_FORM_TOOL_NAME} input. Expected {}.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          OPEN_CODE_EVALUATOR_FORM_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The dataset-backed playground is not mounted; cannot open the evaluator form.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Code-evaluator form opened.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

/** Runs the mounted code-evaluator draft against its test payload. */
const testCodeEvaluatorDraftAgentTool =
  createRegisteredAgentTool<TestCodeEvaluatorDraftInput>({
    name: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseTestCodeEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME} input.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const action =
        agentStore.getState().registeredClientActions[
          TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME
        ];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText:
            "The code-evaluator test section is not mounted; cannot test the draft.",
        });
        return;
      }
      const result = await action(input);
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output ?? "Code-evaluator draft tested.",
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });

/** Ordered registry of all frontend-executable tools. */
const agentToolRegistry: RegisteredAgentTool<unknown>[] = [
  bashAgentTool as RegisteredAgentTool<unknown>,
  askUserAgentTool as RegisteredAgentTool<unknown>,
  setTimeRangeAgentTool as RegisteredAgentTool<unknown>,
  renderGenerativeUIAgentTool as RegisteredAgentTool<unknown>,
  setSpansFilterAgentTool as RegisteredAgentTool<unknown>,
  readPromptAgentTool as RegisteredAgentTool<unknown>,
  clonePromptInstanceAgentTool as RegisteredAgentTool<unknown>,
  listPlaygroundModelTargetsAgentTool as RegisteredAgentTool<unknown>,
  setPlaygroundModelAgentTool as RegisteredAgentTool<unknown>,
  editPromptAgentTool as RegisteredAgentTool<unknown>,
  savePromptAgentTool as RegisteredAgentTool<unknown>,
  readPromptToolsAgentTool as RegisteredAgentTool<unknown>,
  writePromptToolsAgentTool as RegisteredAgentTool<unknown>,
  loadDatasetAgentTool as RegisteredAgentTool<unknown>,
  runPlaygroundAgentTool as RegisteredAgentTool<unknown>,
  readPlaygroundOutputAgentTool as RegisteredAgentTool<unknown>,
  setVariableValuesAgentTool as RegisteredAgentTool<unknown>,
  batchSpanAnnotateAgentTool as RegisteredAgentTool<unknown>,
  openCodeEvaluatorFormAgentTool as RegisteredAgentTool<unknown>,
  readCodeEvaluatorDraftAgentTool as RegisteredAgentTool<unknown>,
  editCodeEvaluatorDraftAgentTool as RegisteredAgentTool<unknown>,
  testCodeEvaluatorDraftAgentTool as RegisteredAgentTool<unknown>,
];

/** Fast lookup map for runtime tool dispatch by name. */
const agentToolRegistryByName = new Map<string, RegisteredAgentTool<unknown>>(
  agentToolRegistry.map((tool) => [tool.name, tool])
);

export function getAgentToolUIBehavior(
  toolName: string
): AgentToolUIBehavior | undefined {
  return agentToolRegistryByName.get(toolName)?.uiBehavior;
}

/** Returns the capability keys required by a tool that are currently disabled. */
function getMissingCapabilities({
  registeredTool,
  capabilities,
}: {
  registeredTool: RegisteredAgentTool<unknown>;
  capabilities: AgentCapabilities;
}): AgentCapabilityKey[] {
  return (
    registeredTool.requiredCapabilities?.filter(
      (capabilityKey: AgentCapabilityKey) => !capabilities[capabilityKey]
    ) ?? []
  );
}

/** Formats a stable user-facing error for capability-gated tool calls. */
function buildMissingCapabilitiesErrorText(
  missingCapabilities: AgentCapabilityKey[]
): string {
  return [
    "This tool call requires capabilities that are currently disabled:",
    ...missingCapabilities.map(
      (capabilityKey) =>
        `- ${getAgentCapabilityDefinition(capabilityKey).label}`
    ),
  ].join("\n");
}

/**
 * Validates and dispatches one tool call from the AI SDK runtime to the
 * matching frontend tool implementation.
 */
export async function handleRegisteredAgentToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  appendMessagePart,
  agentStore,
}: {
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  appendMessagePart?: AppendMessagePart;
  agentStore: AgentStore;
}) {
  // Server-executed tools (MCP, function tools) run on the Phoenix server;
  // the result streams back as `tool-output-available` and must not be
  // intercepted by the frontend registry.
  if (
    toolCall.providerMetadata?.phoenix?.tool_execution_environment === "server"
  ) {
    return;
  }

  const registeredTool = agentToolRegistryByName.get(toolCall.toolName);

  if (!registeredTool) {
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: `Unknown tool: ${toolCall.toolName}`,
    });
    return;
  }

  const input = registeredTool.parseInput(toolCall.input);

  if (input == null) {
    const invalidInputErrorText =
      typeof registeredTool.invalidInputErrorText === "function"
        ? registeredTool.invalidInputErrorText(toolCall.input)
        : registeredTool.invalidInputErrorText;
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: invalidInputErrorText,
    });
    return;
  }

  const capabilities = agentStore.getState().capabilities;
  const missingCapabilities = getMissingCapabilities({
    registeredTool,
    capabilities,
  });

  if (missingCapabilities.length > 0) {
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: buildMissingCapabilitiesErrorText(missingCapabilities),
    });
    return;
  }

  await registeredTool.execute({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    appendMessagePart: appendMessagePart ?? (() => {}),
    agentStore,
    capabilities,
  });
}
