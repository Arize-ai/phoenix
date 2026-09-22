import type { z } from "zod";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import type { EvaluatorSaveTarget } from "@phoenix/pages/playground/evaluators/evaluatorSaveTarget";
import type {
  PlaygroundEvaluatorTaskCode,
  PlaygroundEvaluatorTaskKind,
  PlaygroundEvaluatorTaskSource,
} from "@phoenix/store/playground";
import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
} from "@phoenix/types";

import type {
  editEvaluatorTaskInputSchema,
  EvaluatorTaskOutputConfig,
  readEvaluatorTaskInputSchema,
  saveEvaluatorTaskInputSchema,
  setExpectedOutputInputSchema,
} from "./schemas";

export type ReadEvaluatorTaskInput = z.infer<
  typeof readEvaluatorTaskInputSchema
>;

export type EditEvaluatorTaskInput = z.infer<
  typeof editEvaluatorTaskInputSchema
>;

/** The edit as the instance's adapter receives it, already addressed. */
export type EvaluatorTaskEdit = Omit<EditEvaluatorTaskInput, "instanceId">;

export type SaveEvaluatorTaskInput = z.infer<
  typeof saveEvaluatorTaskInputSchema
>;

export type SetExpectedOutputInput = z.infer<
  typeof setExpectedOutputInputSchema
>;

/** One sandbox a code evaluator task may run in. */
export type EvaluatorTaskSandboxConfig = {
  id: string;
  name: string;
  language: CodeEvaluatorLanguage;
};

/** What `playground.evaluator.read` resolves with. */
export type EvaluatorTaskRead = {
  instanceId: number;
  index: number;
  label: string;
  /** Changes exactly when a field `playground.evaluator.edit` can change does. */
  revision: string;
  dirty: boolean;
  kind: PlaygroundEvaluatorTaskKind;
  name: string;
  description: string;
  /** What the task's runs write, and what expected outputs are recorded under. */
  annotationName: string;
  inputMapping: EvaluatorInputMapping;
  outputConfigs: EvaluatorTaskOutputConfig[];
  /** LLM evaluators only. */
  includeExplanation?: boolean;
  code: PlaygroundEvaluatorTaskCode | null;
  source: PlaygroundEvaluatorTaskSource;
  datasetId: string | null;
  saveTarget: EvaluatorSaveTarget;
  validationError: string | null;
  /** Code evaluators only. */
  availableSandboxConfigs?: EvaluatorTaskSandboxConfig[];
  outputConfigRules: string;
};

/**
 * The PXI adapter an evaluator task's editor registers while it is mounted:
 * the task read in the operation's shape, an edit validated as a whole
 * before anything is applied, and the Save button's write.
 */
export type EvaluatorTaskAgentHost = {
  read: () => EvaluatorTaskRead;
  edit: (input: EvaluatorTaskEdit) => UIOperationResult;
  save: (
    expectedRevision: string,
    options: { asNew: boolean }
  ) => Promise<UIOperationResult>;
};
