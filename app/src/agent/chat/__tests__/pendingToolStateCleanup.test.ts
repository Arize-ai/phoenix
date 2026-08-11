import { describe, expect, it, vi } from "vitest";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { LOAD_DATASET_TOOL_NAME } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import { WRITE_PROMPT_TOOLS_TOOL_NAME } from "@phoenix/agent/tools/playgroundPromptTools";
import { SAVE_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundSavePrompt";
import type { AgentState } from "@phoenix/store/agentStore";

import {
  REWIND_CLEANUP_TOOL_NAMES,
  cleanupPendingToolState,
  cleanupResolvedPendingToolState,
} from "../pendingToolStateCleanup";
import type { AgentUIMessage, AgentUIMessagePart } from "../types";

function createStateStub({
  pendingElicitationBySessionId = {},
}: {
  pendingElicitationBySessionId?: Record<
    string,
    { toolCallId: string; questions: never[] }
  >;
} = {}) {
  return {
    setPendingPromptEdit: vi.fn(),
    setPendingPromptInstanceRemoval: vi.fn(),
    setPendingBatchSpanAnnotate: vi.fn(),
    setPendingPromptToolWrite: vi.fn(),
    setPendingSavePrompt: vi.fn(),
    setPendingCodeEvaluatorEdit: vi.fn(),
    setPendingLlmEvaluatorEdit: vi.fn(),
    setPendingLoadDataset: vi.fn(),
    setPendingElicitation: vi.fn(),
    pendingElicitationBySessionId,
  };
}

function getSetters(state: ReturnType<typeof createStateStub>) {
  return Object.entries(state).filter(
    ([, value]) => typeof value === "function"
  ) as Array<[string, ReturnType<typeof vi.fn>]>;
}

describe("cleanupPendingToolState", () => {
  it.each([
    [EDIT_PROMPT_TOOL_NAME, "setPendingPromptEdit"],
    [REMOVE_PROMPT_INSTANCE_TOOL_NAME, "setPendingPromptInstanceRemoval"],
    [BATCH_SPAN_ANNOTATE_TOOL_NAME, "setPendingBatchSpanAnnotate"],
    [WRITE_PROMPT_TOOLS_TOOL_NAME, "setPendingPromptToolWrite"],
    [SAVE_PROMPT_TOOL_NAME, "setPendingSavePrompt"],
    [EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME, "setPendingCodeEvaluatorEdit"],
    [EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME, "setPendingLlmEvaluatorEdit"],
    [LOAD_DATASET_TOOL_NAME, "setPendingLoadDataset"],
  ] as const)(
    "clears pending state for %s via the matching setter",
    (tool, setterName) => {
      const state = createStateStub();
      cleanupPendingToolState(state as unknown as AgentState, tool, "call-1");
      expect(state[setterName]).toHaveBeenCalledExactlyOnceWith("call-1", null);
      const otherSetters = getSetters(state).filter(
        ([name]) => name !== setterName
      );
      for (const [, setter] of otherSetters) {
        expect(setter).not.toHaveBeenCalled();
      }
    }
  );

  it("clears the pending elicitation owned by an ask_user tool call", () => {
    const state = createStateStub({
      pendingElicitationBySessionId: {
        "session-1": { toolCallId: "call-1", questions: [] },
        "session-2": { toolCallId: "call-2", questions: [] },
      },
    });
    cleanupPendingToolState(
      state as unknown as AgentState,
      ASK_USER_TOOL_NAME,
      "call-1"
    );
    expect(state.setPendingElicitation).toHaveBeenCalledExactlyOnceWith(
      "session-1",
      null
    );
  });

  it("leaves elicitations owned by other tool calls alone", () => {
    const state = createStateStub({
      pendingElicitationBySessionId: {
        "session-1": { toolCallId: "call-1", questions: [] },
      },
    });
    cleanupPendingToolState(
      state as unknown as AgentState,
      ASK_USER_TOOL_NAME,
      "call-other"
    );
    expect(state.setPendingElicitation).not.toHaveBeenCalled();
  });

  it("is a no-op for tools without registered pending state", () => {
    const state = createStateStub();
    cleanupPendingToolState(
      state as unknown as AgentState,
      "unknown_tool",
      "call-1"
    );
    for (const [, setter] of getSetters(state)) {
      expect(setter).not.toHaveBeenCalled();
    }
  });
});

describe("cleanupResolvedPendingToolState", () => {
  const editPromptPart = (
    state: "input-available" | "approval-requested" | "output-error",
    toolCallId: string
  ) =>
    ({
      type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
      toolCallId,
      state,
      input: {},
      ...(state === "output-error"
        ? {
            errorText:
              "The tool call was interrupted before a result was produced.",
          }
        : {}),
    }) as AgentUIMessagePart;

  it("clears pending state for tool calls the transcript shows as resolved", () => {
    const state = createStateStub();
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [editPromptPart("output-error", "call-1")],
      },
    ] as AgentUIMessage[];

    cleanupResolvedPendingToolState(state as unknown as AgentState, messages);

    expect(state.setPendingPromptEdit).toHaveBeenCalledExactlyOnceWith(
      "call-1",
      null
    );
  });

  it("clears the pending elicitation when a synced transcript shows the ask_user call resolved", () => {
    const state = createStateStub({
      pendingElicitationBySessionId: {
        "session-1": { toolCallId: "call-1", questions: [] },
      },
    });
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${ASK_USER_TOOL_NAME}`,
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: {},
          } as AgentUIMessagePart,
        ],
      },
    ] as AgentUIMessage[];

    cleanupResolvedPendingToolState(state as unknown as AgentState, messages);

    expect(state.setPendingElicitation).toHaveBeenCalledExactlyOnceWith(
      "session-1",
      null
    );
  });

  it("leaves pending state alone while the transcript still shows the call unresolved", () => {
    const state = createStateStub();
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          editPromptPart("input-available", "call-1"),
          editPromptPart("approval-requested", "call-2"),
        ],
      },
    ] as AgentUIMessage[];

    cleanupResolvedPendingToolState(state as unknown as AgentState, messages);

    expect(state.setPendingPromptEdit).not.toHaveBeenCalled();
  });
});

describe("REWIND_CLEANUP_TOOL_NAMES", () => {
  it("covers only the approval tools cleaned up on rewind or branch", () => {
    expect([...REWIND_CLEANUP_TOOL_NAMES].sort()).toEqual(
      [
        EDIT_PROMPT_TOOL_NAME,
        REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        BATCH_SPAN_ANNOTATE_TOOL_NAME,
        WRITE_PROMPT_TOOLS_TOOL_NAME,
      ].sort()
    );
  });
});
