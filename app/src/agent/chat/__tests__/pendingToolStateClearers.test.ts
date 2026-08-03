import { describe, expect, it, vi } from "vitest";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/codeEvaluatorDraft";
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
  REWIND_CLEARED_TOOL_NAMES,
  clearPendingToolState,
} from "../pendingToolStateClearers";

function createStateStub() {
  return {
    setPendingPromptEdit: vi.fn(),
    setPendingPromptInstanceRemoval: vi.fn(),
    setPendingBatchSpanAnnotate: vi.fn(),
    setPendingPromptToolWrite: vi.fn(),
    setPendingSavePrompt: vi.fn(),
    setPendingCodeEvaluatorEdit: vi.fn(),
    setPendingLlmEvaluatorEdit: vi.fn(),
    setPendingLoadDataset: vi.fn(),
  };
}

describe("clearPendingToolState", () => {
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
      clearPendingToolState(state as unknown as AgentState, tool, "call-1");
      expect(state[setterName]).toHaveBeenCalledExactlyOnceWith("call-1", null);
      const otherSetters = Object.entries(state).filter(
        ([name]) => name !== setterName
      );
      for (const [, setter] of otherSetters) {
        expect(setter).not.toHaveBeenCalled();
      }
    }
  );

  it("is a no-op for tools without registered pending state", () => {
    const state = createStateStub();
    clearPendingToolState(
      state as unknown as AgentState,
      "unknown_tool",
      "call-1"
    );
    for (const setter of Object.values(state)) {
      expect(setter).not.toHaveBeenCalled();
    }
  });
});

describe("REWIND_CLEARED_TOOL_NAMES", () => {
  it("covers only the approval tools released on rewind or branch", () => {
    expect([...REWIND_CLEARED_TOOL_NAMES].sort()).toEqual(
      [
        EDIT_PROMPT_TOOL_NAME,
        REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        BATCH_SPAN_ANNOTATE_TOOL_NAME,
        WRITE_PROMPT_TOOLS_TOOL_NAME,
      ].sort()
    );
  });
});
