import type { EvaluatorKind } from "@phoenix/types";

/**
 * An evaluator the user is about to remove from a project or dataset.
 */
export type EvaluatorToDelete = {
  id: string;
  name: string;
  kind: EvaluatorKind;
};

/**
 * Where the evaluators being removed are attached:
 * - `project` / `dataset`: all of them belong to the project or dataset on screen.
 * - `anyProject` / `anyDataset`: they may belong to different projects or datasets.
 * - `anywhere`: they may belong to any project or dataset.
 */
export type DeleteEvaluatorsTarget =
  | "project"
  | "dataset"
  | "anyProject"
  | "anyDataset"
  | "anywhere";

const ATTACHMENT_PHRASES: Record<
  DeleteEvaluatorsTarget,
  { singular: string; plural: string }
> = {
  project: { singular: "this project", plural: "this project" },
  dataset: { singular: "this dataset", plural: "this dataset" },
  anyProject: { singular: "its project", plural: "their projects" },
  anyDataset: { singular: "its dataset", plural: "their datasets" },
  anywhere: {
    singular: "its project or dataset",
    plural: "their projects and datasets",
  },
};

/**
 * The "delete associated …" checkbox label, or null when no selected
 * evaluator has a prompt or decision to delete.
 */
export function getDeleteAssociatedLabel(
  evaluators: ReadonlyArray<Pick<EvaluatorToDelete, "kind">>
): string | null {
  const promptCount = evaluators.filter(({ kind }) => kind === "LLM").length;
  const decisionCount = evaluators.filter(
    ({ kind }) => kind === "DECISION"
  ).length;
  const parts: string[] = [];
  if (promptCount > 0) {
    parts.push(promptCount === 1 ? "prompt" : "prompts");
  }
  if (decisionCount > 0) {
    parts.push(decisionCount === 1 ? "decision" : "decisions");
  }
  return parts.length > 0 ? `Delete associated ${parts.join(" and ")}` : null;
}

/**
 * The copy of the delete-evaluators confirmation dialog and its success
 * notification.
 */
export function getDeleteEvaluatorsCopy({
  evaluators,
  target,
}: {
  evaluators: ReadonlyArray<Pick<EvaluatorToDelete, "name" | "kind">>;
  target: DeleteEvaluatorsTarget;
}) {
  const count = evaluators.length;
  const isPlural = count !== 1;
  const attachment =
    ATTACHMENT_PHRASES[target][isPlural ? "plural" : "singular"];
  const builtInCount = evaluators.filter(
    ({ kind }) => kind === "BUILTIN"
  ).length;
  if (!isPlural) {
    const [{ name, kind }] = evaluators;
    return {
      title: "Delete evaluator",
      confirmLabel: "Delete evaluator",
      description: `Remove “${name}” from ${attachment}. Its evaluation traces are deleted in the background. ${
        kind === "BUILTIN"
          ? "The built-in evaluator remains available elsewhere."
          : "The evaluator is deleted only if it isn't used anywhere else."
      }`,
      successTitle: "Evaluator removed",
      successMessage: `Evaluator “${name}” was removed from ${attachment}.`,
    };
  }
  const noun = `${count} evaluators`;
  return {
    title: "Delete evaluators",
    confirmLabel: `Delete ${noun}`,
    description: `Remove ${noun} from ${attachment}. Their evaluation traces are deleted in the background. ${
      builtInCount === count
        ? "Built-in evaluators remain available elsewhere."
        : builtInCount > 0
          ? "Built-in evaluators remain available elsewhere, and the others are deleted only if they aren't used anywhere else."
          : "Each evaluator is deleted only if it isn't used anywhere else."
    }`,
    successTitle: "Evaluators removed",
    successMessage: `${count} evaluators were removed from ${attachment}.`,
  };
}
