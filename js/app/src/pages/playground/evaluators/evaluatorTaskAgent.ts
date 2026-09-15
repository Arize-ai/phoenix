import { toOutputConfigDrafts } from "@phoenix/agent/tools/codeEvaluatorDraft/outputConfigConverters";
import { toEvaluatorTaskOutputConfigs } from "@phoenix/agent/tools/playgroundEvaluator/outputConfigs";
import type {
  EvaluatorTaskAgentHost,
  EvaluatorTaskEdit,
  EvaluatorTaskRead,
  EvaluatorTaskSandboxConfig,
} from "@phoenix/agent/tools/playgroundEvaluator/types";
import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt/promptStore";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { getEvaluatorOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";
import type {
  PlaygroundEvaluatorTask,
  PlaygroundEvaluatorTaskCode,
  PlaygroundEvaluatorTaskKind,
  PlaygroundStore,
} from "@phoenix/store/playground";
import { getPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import { getEvaluatorTaskAnnotation } from "../evaluatorCells/evaluatorCellResults";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import {
  buildEvaluatorTaskFromStore,
  getEvaluatorTaskRevision,
} from "./evaluatorTaskSnapshot";
import { getDefaultSandboxConfigId } from "./evaluatorTaskValidation";

// Stated on every read so an agent learns the rule before its first edit
// rather than from a rejected run.
const OUTPUT_CONFIG_RULES: Record<PlaygroundEvaluatorTaskKind, string> = {
  LLM: "LLM evaluators support only categorical outputs: the judge picks a label, and the score is that label's score. Express a numeric scale as scored labels (e.g. poor=0, fair=0.5, good=1). Continuous and freeform outputs are rejected on run and save.",
  CODE: "Code evaluators may declare categorical, continuous, or freeform outputs; the function returns the label and/or score.",
};

export type EvaluatorTaskAgentHostParams = {
  instanceId: number;
  /** The editor's evaluator store; the task on the instance mirrors it. */
  store: EvaluatorStoreInstance;
  playgroundStore: PlaygroundStore;
  /** The code fields the editor keeps beside the store; null for an LLM task. */
  getCode: () => PlaygroundEvaluatorTaskCode | null;
  setCode: (code: PlaygroundEvaluatorTaskCode) => void;
  getSandboxConfigs: () => ReadonlyArray<EvaluatorTaskSandboxConfig>;
  getSaveTarget: () => EvaluatorSaveTarget;
  /** Why the given draft of the task cannot run or save, or null. */
  getValidationError: (task: PlaygroundEvaluatorTask) => string | null;
  getDatasetId: () => string | null;
  /** The Save button's write; `asNew` is its "Save as new". */
  save: (options: { asNew: boolean }) => Promise<UIOperationResult>;
};

/**
 * A short token for the task's content. The full revision is the task
 * itself, source code included: too long for the agent to echo back.
 */
function toRevisionToken(revision: string): string {
  let hash = 5381;

  for (let index = 0; index < revision.length; index++) {
    hash = (hash * 33) ^ revision.charCodeAt(index);
  }

  return `evaluator-${(hash >>> 0).toString(16)}`;
}

function staleRevision(revision: string): UIOperationResult {
  return {
    ok: false,
    code: "STALE_REVISION",
    error: `expectedRevision does not match the evaluator task's current revision "${revision}". Retry with the current revision (a successful edit's returned revision is also valid); re-read the task only if you need its latest content.`,
  };
}

function hasCodeFields(input: EvaluatorTaskEdit): boolean {
  return (
    input.sourceCode != null ||
    input.language != null ||
    input.sandboxConfigId != null
  );
}

/**
 * The fields of the patch that do not belong to the task's kind, or a
 * language change on a saved code evaluator, which keeps its language.
 */
function getEditRejection({
  current,
  input,
}: {
  current: EvaluatorTaskRead;
  input: EvaluatorTaskEdit;
}): string | null {
  if (current.kind === "CODE" && input.includeExplanation != null) {
    return "includeExplanation applies to LLM evaluator tasks only.";
  }

  if (current.kind === "LLM" && hasCodeFields(input)) {
    return "language, sourceCode and sandboxConfigId apply to CODE evaluator tasks only. An LLM evaluator's judge prompt is edited with playground.prompt.edit.";
  }

  if (
    input.language &&
    input.language !== current.code?.language &&
    current.saveTarget.action !== "create"
  ) {
    return "A saved code evaluator keeps its language. Select a new code evaluator to change it.";
  }

  return null;
}

/**
 * The code fields after the patch. Changing the language without naming a
 * sandbox picks a compatible one, as the editor's language field does.
 */
function getNextCode({
  code,
  input,
  sandboxConfigs,
}: {
  code: PlaygroundEvaluatorTaskCode;
  input: EvaluatorTaskEdit;
  sandboxConfigs: ReadonlyArray<EvaluatorTaskSandboxConfig>;
}): PlaygroundEvaluatorTaskCode {
  const language = input.language ?? code.language;

  const sandboxConfigId =
    input.sandboxConfigId ??
    (language !== code.language
      ? getDefaultSandboxConfigId({ sandboxConfigs, language })
      : code.sandboxConfigId);

  return {
    language,
    sourceCode: input.sourceCode ?? code.sourceCode,
    sandboxConfigId,
  };
}

/** Why the patched code cannot run: no sandbox, or one for another language. */
function getCodeRejection({
  next,
  input,
  sandboxConfigs,
}: {
  next: PlaygroundEvaluatorTaskCode;
  input: EvaluatorTaskEdit;
  sandboxConfigs: ReadonlyArray<EvaluatorTaskSandboxConfig>;
}): string | null {
  if (input.language == null && input.sandboxConfigId == null) {
    return null;
  }

  const isCompatible = sandboxConfigs.some(
    (config) =>
      config.id === next.sandboxConfigId && config.language === next.language
  );

  return isCompatible
    ? null
    : `No available sandbox runs ${next.language} under that selection. Choose a compatible sandbox from availableSandboxConfigs.`;
}

/**
 * The PXI adapter of one evaluator task's editor. Created once per editor
 * mount; everything that changes is read through the getters, so the
 * registered host stays the same object across renders.
 */
export function createEvaluatorTaskAgentHost({
  instanceId,
  store,
  playgroundStore,
  getCode,
  setCode,
  getSandboxConfigs,
  getSaveTarget,
  getValidationError,
  getDatasetId,
  save,
}: EvaluatorTaskAgentHostParams): EvaluatorTaskAgentHost {
  /** The task as the editor's state stands for it, with the given code fields. */
  function readTask(code: PlaygroundEvaluatorTaskCode | null) {
    const state = playgroundStore.getState();

    const index = state.instances.findIndex(
      (instance) => instance.id === instanceId
    );

    const current = getPlaygroundEvaluatorTask(state.instances[index]);

    if (!current) {
      throw new Error(
        `Playground instance ${instanceId} is not an evaluator task.`
      );
    }

    return {
      index,
      dirty: state.dirtyInstances[instanceId] === true,
      task: buildEvaluatorTaskFromStore({
        state: store.getState(),
        code,
        current,
      }),
    };
  }

  function read(code = getCode()): EvaluatorTaskRead {
    const { index, dirty, task } = readTask(code);

    const snapshot: EvaluatorTaskRead = {
      instanceId,
      index,
      label: getInstanceLabel(index),
      revision: toRevisionToken(getEvaluatorTaskRevision(task)),
      dirty,
      kind: task.kind,
      name: task.name,
      description: task.description,
      annotationName: getEvaluatorTaskAnnotation({
        evaluator: task,
        position: index,
      }).name,
      inputMapping: task.inputMapping,
      outputConfigs: toOutputConfigDrafts(task.outputConfigs),
      code: task.code,
      source: task.source,
      datasetId: getDatasetId(),
      saveTarget: getSaveTarget(),
      validationError: getValidationError(task),
      outputConfigRules: OUTPUT_CONFIG_RULES[task.kind],
    };

    if (task.kind === "LLM") {
      snapshot.includeExplanation = task.includeExplanation;
    }

    if (task.kind === "CODE") {
      snapshot.availableSandboxConfigs = [...getSandboxConfigs()];
    }

    return snapshot;
  }

  function edit(input: EvaluatorTaskEdit): UIOperationResult {
    const current = read();

    if (input.expectedRevision !== current.revision) {
      return staleRevision(current.revision);
    }

    const rejection = getEditRejection({ current, input });

    if (rejection) {
      return { ok: false, error: rejection };
    }

    const outputConfigs = input.outputConfigs
      ? toEvaluatorTaskOutputConfigs(input.outputConfigs)
      : null;

    const outputErrors = outputConfigs
      ? getEvaluatorOutputConfigValidationErrors({
          kind: current.kind,
          configs: outputConfigs,
        })
      : [];

    if (outputErrors.length) {
      return { ok: false, error: outputErrors.join("\n") };
    }

    const sandboxConfigs = getSandboxConfigs();

    const nextCode = current.code
      ? getNextCode({ code: current.code, input, sandboxConfigs })
      : null;

    const codeRejection = nextCode
      ? getCodeRejection({ next: nextCode, input, sandboxConfigs })
      : null;

    if (codeRejection) {
      return { ok: false, error: codeRejection };
    }

    // The whole patch passed; only now does anything change.
    const state = store.getState();

    if (input.name != null) state.setEvaluatorGlobalName(input.name);

    if (input.description != null) {
      state.setEvaluatorDescription(input.description);
    }

    if (outputConfigs) state.setOutputConfigs(outputConfigs);

    if (input.inputMapping) {
      state.setPathMapping(input.inputMapping.pathMapping);
      state.setLiteralMapping(input.inputMapping.literalMapping);
    }

    if (input.includeExplanation != null) {
      state.setIncludeExplanation(input.includeExplanation);
    }

    if (nextCode && hasCodeFields(input)) setCode(nextCode);

    return { ok: true, output: read(nextCode) };
  }

  async function saveTask(
    expectedRevision: string,
    options: { asNew: boolean }
  ): Promise<UIOperationResult> {
    const current = read();

    if (expectedRevision !== current.revision) {
      return staleRevision(current.revision);
    }

    if (current.validationError) {
      return {
        ok: false,
        error: `The evaluator task cannot be saved yet: ${current.validationError}`,
      };
    }

    return save(options);
  }

  return { read: () => read(), edit, save: saveTask };
}
