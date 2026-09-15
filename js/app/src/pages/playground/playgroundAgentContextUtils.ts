import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type {
  ExperimentScaffold,
  PlaygroundInstance,
  PlaygroundTask,
  PlaygroundTaskKind,
} from "@phoenix/store/playground";

import { getEvaluatorTaskName } from "./evaluators/evaluatorTaskSnapshot";

type PlaygroundAgentContext = Extract<AgentContext, { type: "playground" }>;
type PlaygroundAgentInstance = NonNullable<
  PlaygroundAgentContext["instances"]
>[number];

type PlaygroundAgentTask = NonNullable<PlaygroundAgentInstance["task"]>;

type PlaygroundAgentScaffold = NonNullable<
  PlaygroundAgentContext["nextExperimentScaffold"]
>;

function getPlaygroundModelForAgent(
  model: PlaygroundInstance["model"]
): PlaygroundAgentInstance["model"] {
  const { modelName } = model;

  if (modelName == null) {
    return undefined;
  }

  if (model.customProvider) {
    return {
      type: "custom",
      customProviderId: model.customProvider.id,
      customProviderName: model.customProvider.name,
      provider: model.provider,
      modelName,
    };
  }

  return { type: "builtin", provider: model.provider, modelName };
}

/**
 * The task as the agent sees it. A nameless evaluator draft is advertised
 * under the name its runs use, which depends on its position.
 */
function getPlaygroundTaskForAgent(
  task: PlaygroundTask,
  { index, isDirty }: { index: number; isDirty: boolean }
): PlaygroundAgentTask {
  if (task.kind === "prompt") {
    return { kind: "prompt" };
  }

  return {
    kind: "evaluator",
    evaluatorKind: task.evaluator.kind,
    name: getEvaluatorTaskName(task.evaluator, index),
    isDirty,
  };
}

export function getPlaygroundInstanceForAgent(
  instance: Pick<PlaygroundInstance, "id" | "model" | "experiment" | "task">,
  { index, isDirty }: { index: number; isDirty: boolean }
): PlaygroundAgentInstance {
  const model = getPlaygroundModelForAgent(instance.model);

  const agentInstance: PlaygroundAgentInstance = {
    instanceId: instance.id,
    // Surface the experiment id whenever a run produced one, including
    // ephemeral experiments: those persist in the DB for ~24h (the server
    // sweeps them only after EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS), so they
    // stay queryable via phoenix-gql within the window the agent reads this
    // context.
    experimentId: instance.experiment?.id,
    task: getPlaygroundTaskForAgent(instance.task, { index, isDirty }),
  };

  if (model) {
    agentInstance.model = model;
  }

  return agentInstance;
}

function arePlaygroundAgentModelsEqual(
  left: PlaygroundAgentInstance["model"],
  right: PlaygroundAgentInstance["model"]
): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  if (
    left.type !== right.type ||
    left.provider !== right.provider ||
    left.modelName !== right.modelName
  ) {
    return false;
  }
  if (left.type === "custom" && right.type === "custom") {
    return (
      left.customProviderId === right.customProviderId &&
      left.customProviderName === right.customProviderName
    );
  }
  return true;
}

function arePlaygroundAgentTasksEqual(
  left: PlaygroundAgentInstance["task"],
  right: PlaygroundAgentInstance["task"]
): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }

  if (left.kind === "evaluator" && right.kind === "evaluator") {
    return (
      left.evaluatorKind === right.evaluatorKind &&
      left.name === right.name &&
      left.isDirty === right.isDirty
    );
  }

  return left.kind === right.kind;
}

export function getExperimentScaffoldForAgent(
  scaffold: ExperimentScaffold | null
): PlaygroundAgentScaffold | null {
  if (scaffold == null) {
    return null;
  }
  return {
    name: scaffold.name ?? null,
    description: scaffold.description ?? null,
    hasMetadata:
      scaffold.metadata != null && Object.keys(scaffold.metadata).length > 0,
  };
}

export function areExperimentScaffoldsForAgentEqual(
  left: PlaygroundAgentScaffold | null,
  right: PlaygroundAgentScaffold | null
): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.hasMetadata === right.hasMetadata
  );
}

export function arePlaygroundInstancesForAgentEqual(
  left: PlaygroundAgentInstance[],
  right: PlaygroundAgentInstance[]
): boolean {
  return (
    left.length === right.length &&
    left.every((leftInstance, index) => {
      const rightInstance = right[index];
      return (
        rightInstance != null &&
        leftInstance.instanceId === rightInstance.instanceId &&
        leftInstance.experimentId === rightInstance.experimentId &&
        arePlaygroundAgentModelsEqual(
          leftInstance.model,
          rightInstance.model
        ) &&
        arePlaygroundAgentTasksEqual(leftInstance.task, rightInstance.task)
      );
    })
  );
}

export function buildPlaygroundAgentContext({
  taskKind,
  recordExperiments,
  repetitions,
  nextExperimentScaffold,
  instances,
}: {
  taskKind: PlaygroundTaskKind;
  recordExperiments: boolean;
  repetitions: number;
  nextExperimentScaffold: PlaygroundAgentScaffold | null;
  instances: PlaygroundAgentInstance[];
}): PlaygroundAgentContext {
  return {
    type: "playground",
    taskKind,
    recordExperiments,
    repetitions,
    nextExperimentScaffold: nextExperimentScaffold ?? undefined,
    instances,
  };
}
