import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/llmEvaluatorDraft";
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
      getEditingEvaluator: () => null,
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
      getEditingEvaluator: () => null,
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
      getEditingEvaluator: () => null,
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
      getEditingEvaluator: () => null,
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
      getEditingEvaluator: () => null,
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

  it("rejects opening a code evaluator while a different-kind create form is mounted", async () => {
    const agentStore = createAgentStore();
    // An LLM create form is mounted (its draft tools are registered) but does not occupy the slot.
    agentStore
      .getState()
      .registerClientAction(EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME, noop);
    let openCalled = false;
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "CODE" })],
      getEditingEvaluator: () => null,
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
  });

  it("rejects opening a different-kind evaluator while the shared edit slot is occupied", async () => {
    const agentStore = createAgentStore();
    // The slot holds a CODE edit and its CODE draft tools are registered; the LLM target's
    // per-kind check would miss the collision, so only the slot guard catches it.
    agentStore
      .getState()
      .registerClientAction(EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME, noop);
    let openCalled = false;
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "LLM" })],
      getEditingEvaluator: () => ({
        datasetEvaluatorId: "code-being-edited",
        kind: "CODE",
        isBuiltIn: false,
      }),
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
    // The mounted code draft action is untouched.
    expect(
      EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME in
        agentStore.getState().registeredClientActions
    ).toBe(true);
  });

  it("rejects opening a built-in edit form collision via the shared slot", async () => {
    const agentStore = createAgentStore();
    // A built-in edit form registers no draft tools, so only the shared slot
    // guard can catch a collision with it.
    let openCalled = false;
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [evaluator({ id: "a", kind: "CODE" })],
      getEditingEvaluator: () => ({
        datasetEvaluatorId: "builtin-being-edited",
        kind: "BUILTIN",
        isBuiltIn: true,
      }),
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
  });

  it("rejects invalid input", async () => {
    const agentStore = createAgentStore();
    const action = createOpenDatasetEvaluatorForEditClientAction({
      agentStore,
      getEvaluators: () => [],
      getEditingEvaluator: () => null,
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
