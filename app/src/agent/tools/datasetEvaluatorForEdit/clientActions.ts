import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import type { EvaluatorKind } from "@phoenix/types";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";
import { waitForRegisteredClientActions } from "@phoenix/store/agentStore";

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

/**
 * Open an existing code or LLM evaluator's edit slideover by id.
 *
 * The target id is re-resolved against the live roster (catching deletion and
 * not-editable kind), then the same-kind draft host is checked: because draft
 * client actions register in a single by-name map, a mounted create or edit form
 * of the same kind would be clobbered by the slideover this opens, so the call is
 * rejected and the user is told to close the open form — the mounted draft is
 * never auto-discarded.
 */
export function createOpenDatasetEvaluatorForEditClientAction({
  agentStore,
  getEvaluators,
  openEvaluatorForEdit,
}: {
  agentStore: AgentStore;
  getEvaluators: () => EvaluatorItem[];
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

    const registeredClientActions =
      agentStore.getState().registeredClientActions;
    const mountedSameKind = DRAFT_TOOL_NAMES_BY_KIND[editableKind].some(
      (name) => name in registeredClientActions
    );
    if (mountedSameKind) {
      return {
        ok: false,
        error:
          `A ${editableKind === "CODE" ? "code" : "LLM"}-evaluator form is ` +
          "already open. Ask the user to close it, then retry — the open form's " +
          "unsaved changes are not discarded automatically.",
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
