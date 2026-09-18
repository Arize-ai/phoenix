import type { EvaluatorDefinitionInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
} from "@phoenix/components/evaluators/utils";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type EvaluatorStore,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type {
  PlaygroundEvaluatorTask,
  PlaygroundEvaluatorTaskCode,
  PlaygroundStore,
} from "@phoenix/store/playground";

/**
 * The evaluator store an evaluator task's editor opens with. The shared
 * evaluator components read this store; the task on the playground
 * instance is the snapshot the page keeps of it.
 */
export function createEvaluatorTaskStoreState(
  evaluator: PlaygroundEvaluatorTask
): EvaluatorStoreProps {
  return {
    ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
    evaluator: {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
      kind: evaluator.kind,
      isBuiltin: false,
      globalName: evaluator.name,
      name: "",
      description: evaluator.description,
      inputMapping: evaluator.inputMapping,
      includeExplanation: evaluator.includeExplanation,
    },
    outputConfigs: evaluator.outputConfigs,
  };
}

/**
 * The task the editor's state stands for: what the evaluator store owns,
 * the code fields the editor keeps beside it, and the reference and saved
 * revision the current task already carries.
 */
export function buildEvaluatorTaskFromStore({
  state,
  code,
  current,
}: {
  state: Pick<EvaluatorStore, "evaluator" | "outputConfigs">;
  code: PlaygroundEvaluatorTaskCode | null;
  current: PlaygroundEvaluatorTask;
}): PlaygroundEvaluatorTask {
  return {
    kind: current.kind,
    name: state.evaluator.globalName,
    description: state.evaluator.description,
    outputConfigs: state.outputConfigs,
    inputMapping: state.evaluator.inputMapping,
    includeExplanation: state.evaluator.includeExplanation,
    code: current.kind === "CODE" ? code : null,
    source: current.source,
    savedRevision: current.savedRevision,
  };
}

/**
 * A string that changes exactly when the evaluator's content does. The
 * reference and saved revision are left out: they describe where the
 * content came from, not what it is.
 */
export function getEvaluatorTaskRevision(
  evaluator: PlaygroundEvaluatorTask
): string {
  return JSON.stringify({
    kind: evaluator.kind,
    name: evaluator.name,
    description: evaluator.description,
    outputConfigs: evaluator.outputConfigs,
    inputMapping: evaluator.inputMapping,
    includeExplanation: evaluator.includeExplanation,
    code: evaluator.code,
  });
}

/** The name a run and a save use for a draft that has none yet. */
export function getEvaluatorTaskName(
  evaluator: Pick<PlaygroundEvaluatorTask, "name">,
  position: number
): string {
  return evaluator.name.trim() || `evaluator_${position + 1}`;
}

/**
 * The inline evaluator a run or a save sends for the task. The LLM branch
 * reads the judge prompt from the instance's template and model; it throws
 * when the instance cannot be turned into a prompt version yet.
 */
export function getEvaluatorTaskPreview({
  evaluator,
  name,
  playgroundStore,
  instanceId,
  datasetId,
}: {
  evaluator: PlaygroundEvaluatorTask;
  name: string;
  playgroundStore: PlaygroundStore;
  instanceId: number;
  datasetId: string | null;
}): EvaluatorDefinitionInput {
  if (evaluator.kind === "CODE") {
    const code = evaluator.code;

    if (!code) {
      throw new Error("Enter evaluator code before running.");
    }

    return {
      inlineCodeEvaluator: {
        name,
        language: code.language,
        sourceCode: code.sourceCode,
        sandboxConfigId: code.sandboxConfigId,
        outputConfigs: buildOutputConfigsInput(evaluator.outputConfigs),
      },
    };
  }

  const payload = createLLMEvaluatorPayload({
    playgroundStore,
    instanceId,
    name,
    description: evaluator.description,
    outputConfigs: evaluator.outputConfigs,
    datasetId: datasetId ?? "",
    inputMapping: evaluator.inputMapping,
    includeExplanation: evaluator.includeExplanation,
  });

  return {
    inlineLlmEvaluator: {
      name: payload.name,
      description: payload.description,
      outputConfigs: payload.outputConfigs,
      promptVersion: payload.promptVersion,
    },
  };
}
