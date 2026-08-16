import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";
import { waitForRegisteredClientActions } from "@phoenix/store/agentStore";
import type { EvaluatorKind } from "@phoenix/types";

import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "../codeEvaluatorDraft";
import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "../llmEvaluatorDraft";
import { parseOpenDatasetEvaluatorForEditInput } from "./parsers";

type EditableKind = "CODE" | "LLM";

const DRAFT_TOOL_NAMES_BY_KIND: Record<EditableKind, readonly string[]> = {
  CODE: [
    READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  ],
  LLM: [
    READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  ],
};

const ALL_DRAFT_TOOL_NAMES: readonly string[] = [
  ...DRAFT_TOOL_NAMES_BY_KIND.CODE,
  ...DRAFT_TOOL_NAMES_BY_KIND.LLM,
];

export type OpenEvaluatorForEditTarget = {
  datasetEvaluatorId: string;
  kind: EvaluatorKind;
  isBuiltIn: boolean;
};

function resolveEditableKind(evaluator: EvaluatorItem): EditableKind | null {
  if (evaluator.isBuiltIn) {
    return null;
  }
  if (evaluator.kind === "CODE" || evaluator.kind === "LLM") {
    return evaluator.kind;
  }
  return null;
}

export function createOpenDatasetEvaluatorForEditClientAction({
  agentStore,
  getEvaluators,
  getEditingEvaluator,
  openEvaluatorForEdit,
}: {
  agentStore: AgentStore;
  getEvaluators: () => EvaluatorItem[];
  getEditingEvaluator: () => OpenEvaluatorForEditTarget | null;
  openEvaluatorForEdit: (target: OpenEvaluatorForEditTarget) => void;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseOpenDatasetEvaluatorForEditInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid open_dataset_evaluator_for_edit input.",
      };
    }

    const evaluator = getEvaluators().find(
      (candidate) => candidate.id === parsed.datasetEvaluatorId
    );
    if (!evaluator) {
      return {
        ok: false,
        error:
          "That evaluator id is not on the dataset (it may have been deleted). " +
          "Re-check the roster and retry.",
      };
    }

    const editableKind = resolveEditableKind(evaluator);
    if (!editableKind) {
      return {
        ok: false,
        error:
          "Built-in evaluators can't be edited via the assistant yet. Only code " +
          "and LLM evaluators can be opened for editing.",
      };
    }

    // All three edit slideovers share one editingEvaluator slot (PlaygroundDatasetSection);
    // opening a second clobbers the first's unsaved draft, and a built-in edit form occupies
    // the slot but registers no draft tools.
    if (getEditingEvaluator() !== null) {
      return {
        ok: false,
        error:
          "An evaluator form is already open for editing. Ask the user to " +
          "close it, then retry — the open form's unsaved changes are not " +
          "discarded automatically.",
      };
    }

    // Create forms register their kind's draft tools without touching the slot above.
    const registeredClientActions =
      agentStore.getState().registeredClientActions;
    const draftFormMounted = ALL_DRAFT_TOOL_NAMES.some(
      (name) => name in registeredClientActions
    );
    if (draftFormMounted) {
      return {
        ok: false,
        error:
          "An evaluator form is already open. Ask the user to close it, then " +
          "retry — the open form's unsaved changes are not discarded " +
          "automatically.",
      };
    }

    openEvaluatorForEdit({
      datasetEvaluatorId: evaluator.id,
      kind: evaluator.kind,
      isBuiltIn: evaluator.isBuiltIn,
    });

    const isReady = await waitForRegisteredClientActions({
      agentStore,
      names: DRAFT_TOOL_NAMES_BY_KIND[editableKind],
    });
    if (!isReady) {
      return {
        ok: false,
        error:
          "The evaluator form opened, but its draft tools did not finish " +
          "loading. Try opening the evaluator again before reading the draft.",
      };
    }

    return {
      ok: true,
      output: `Opened the ${editableKind === "CODE" ? "code" : "LLM"}-evaluator form for editing; draft tools are ready.`,
    };
  };
}
