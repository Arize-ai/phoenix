import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import type { PlaygroundInstancePrompt } from "@phoenix/store";
import type { EvaluatorInputMapping } from "@phoenix/types";

import type {
  EvaluatorPlaygroundProjectScope,
  EvaluatorSlotSource,
} from "../evaluatorPlaygroundSource";
import type { EvaluatorSaveTarget } from "../evaluatorSaveTarget";

export type SaveEvaluatorSlotRequest = {
  target: EvaluatorSaveTarget;
  source: EvaluatorSlotSource;
  /** Required for a project source; ignored for a dataset. */
  projectScope?: EvaluatorPlaygroundProjectScope;
  name: string;
  description: string | undefined;
  inputMapping: EvaluatorInputMapping;
  /** The slot's run payload; it already carries the prompt or the code. */
  preview: EvaluatorPreviewInput;
  /**
   * The prompt version the LLM slot was loaded from. The server appends a new
   * version to that prompt only when the content changed; without it, every
   * save would mint a fresh prompt.
   */
  promptVersionId: string | null;
  sandboxConfigId: string | null;
  /** The sandbox the code slot was loaded with, to rebind only on change. */
  initialSandboxConfigId: string | null;
};

export type SavedEvaluatorSlot = {
  /** The dataset evaluator or project evaluator Save left the slot pointing at. */
  bindingId: string;
  bindingKind: EvaluatorSlotSource["kind"];
  /** Whether Save created a binding or changed the one loaded. */
  action: "created" | "updated";
  /** The prompt an updated LLM evaluator now points at. */
  prompt: PlaygroundInstancePrompt | null;
};

/** The prompt an LLM evaluator points at after a save, for the slot to adopt. */
export function toSavedPrompt(evaluator: {
  readonly prompt?: { readonly id: string; readonly name: string } | null;
  readonly promptVersion?: { readonly id: string } | null;
  readonly promptVersionTag?: { readonly name: string } | null;
}): PlaygroundInstancePrompt | null {
  return evaluator.prompt && evaluator.promptVersion
    ? {
        id: evaluator.prompt.id,
        name: evaluator.prompt.name,
        version: evaluator.promptVersion.id,
        tag: evaluator.promptVersionTag?.name ?? null,
      }
    : null;
}
