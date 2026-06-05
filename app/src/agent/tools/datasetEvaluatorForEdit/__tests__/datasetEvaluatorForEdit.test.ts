import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { createAgentStore } from "@phoenix/store/agentStore";

import {
  createOpenDatasetEvaluatorForEditClientAction,
  type OpenEvaluatorForEditTarget,
} from "../clientActions";

installTestStorage();

const noop = async () => ({ ok: true as const });

function evaluator(overrides: Partial<EvaluatorItem> = {}): EvaluatorItem {
  return {
    id: "RXY6MQ==",
    kind: "CODE",
    isBuiltIn: false,
    name: "Exact Match",
    ...overrides,
  };
}

describe("open_dataset_evaluator_for_edit client action", () => {
  it("opens the matching edit slideover and resolves once draft tools mount", async () => {
    const agentStore = createAgentStore();
    const opened: OpenEvaluatorForEditTarget[] = [];
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "CODE" })],
      openEvaluatorForEdit: (target) => {
        opened.push(target);
        // The mounted slideover registers the kind's draft tools.
        const { registerClientAction } = agentStore.getState();
        registerClientAction(READ_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
        registerClientAction(EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
        registerClientAction(TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
      },
    });

    const result = await action({ datasetEvaluatorId: "a" });

    expect(result.ok).toBe(true);
    expect(opened).toEqual([
      { datasetEvaluatorId: "a", kind: "CODE", isBuiltIn: false },
    ]);
  });

  it("rejects a built-in target with a typed not-editable error", async () => {
    const agentStore = createAgentStore();
    let openCalled = false;
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [
        evaluator({ id: "a", kind: "BUILTIN", isBuiltIn: true }),
      ],
      openEvaluatorForEdit: () => {
        openCalled = true;
      },
    });

    const result = await action({ datasetEvaluatorId: "a" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Built-in");
    }
    expect(openCalled).toBe(false);
  });

  it("rejects a built-in-flagged code/LLM target (compound discriminator)", async () => {
    const agentStore = createAgentStore();
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [
        evaluator({ id: "a", kind: "LLM", isBuiltIn: true }),
      ],
      openEvaluatorForEdit: () => {},
    });

    const result = await action({ datasetEvaluatorId: "a" });

    expect(result.ok).toBe(false);
  });

  it("rejects an id that is no longer on the roster", async () => {
    const agentStore = createAgentStore();
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a" })],
      openEvaluatorForEdit: () => {},
    });

    const result = await action({ datasetEvaluatorId: "deleted" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("deleted");
    }
  });

  it("rejects when a same-kind draft host is already mounted, without opening", async () => {
    const agentStore = createAgentStore();
    // A code-evaluator form is already mounted (its draft tools are registered).
    agentStore
      .getState()
      .registerClientAction(EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
    let openCalled = false;
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "CODE" })],
      openEvaluatorForEdit: () => {
        openCalled = true;
      },
    });

    const result = await action({ datasetEvaluatorId: "a" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already open");
    }
    expect(openCalled).toBe(false);
    // The mounted draft action is untouched.
    expect(
      EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME in
        agentStore.getState().registeredClientActions
    ).toBe(true);
  });

  it("allows opening an LLM evaluator while a code form is mounted (different kind)", async () => {
    const agentStore = createAgentStore();
    agentStore
      .getState()
      .registerClientAction(EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "LLM" })],
      openEvaluatorForEdit: () => {
        const { registerClientAction } = agentStore.getState();
        registerClientAction(READ_LLM_EVALUATOR_DRAFT_TOOL_NAME, noop);
        registerClientAction(EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME, noop);
        registerClientAction(TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME, noop);
      },
    });

    const result = await action({ datasetEvaluatorId: "a" });

    expect(result.ok).toBe(true);
  });

  it("rejects invalid input", async () => {
    const agentStore = createAgentStore();
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [],
      openEvaluatorForEdit: () => {},
    });

    const result = await action({ datasetEvaluatorId: "" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid open_dataset_evaluator_for_edit input.",
      })
    );
  });
});
