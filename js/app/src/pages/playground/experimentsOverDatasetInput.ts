import type { CredentialsState } from "@phoenix/store/credentialsStore";
import type {
  PlaygroundNormalizedInstance,
  PlaygroundStore,
} from "@phoenix/store/playground";
import {
  DEFAULT_MAX_CONCURRENCY,
  getPlaygroundEvaluatorTask,
  getTemplateVariablesPath,
  isDecisionInstance,
} from "@phoenix/store/playground";

import type {
  DecisionTaskInput,
  EvaluatorInputMappingInput,
  ExperimentsOverDatasetInput,
  ExperimentTaskInput,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import {
  buildDecisionConnection,
  buildDecisionTaskDefinition,
} from "./decisionUtils";
import {
  getEvaluatorTaskName,
  getEvaluatorTaskPreview,
} from "./evaluators/evaluatorTaskSnapshot";
import {
  getPromptTaskInput,
  resolveNextExperimentField,
  toGqlCredentials,
} from "./playgroundUtils";

/** The dataset evaluators attached to a prompt run, by dataset evaluator id. */
export type PlaygroundEvaluatorMappings = Record<
  string,
  { name: string; inputMapping: EvaluatorInputMappingInput }
>;

/**
 * The input of one experimentsOverDataset subscription: one task per
 * instance, in instance order, so the experiments the server opens the
 * stream with can be matched back to their columns by position. Passing
 * `instanceIds` runs only those instances (a column's play button); their
 * positions in the page still name their evaluators. The store's
 * `runExampleIds` narrows every task to those examples (a row's play button);
 * such a run is a spot check and is never recorded.
 */
export function getExperimentsOverDatasetInput({
  playgroundStore,
  credentials,
  datasetId,
  splitIds,
  evaluatorMappings,
  instanceIds,
}: {
  playgroundStore: PlaygroundStore;
  credentials: CredentialsState;
  datasetId: string;
  splitIds?: string[];
  evaluatorMappings: PlaygroundEvaluatorMappings;
  instanceIds?: readonly number[];
}): ExperimentsOverDatasetInput {
  const {
    instances,
    repetitions,
    stateByDatasetId,
    recordExperiments,
    runExampleIds,
    nextExperimentScaffold,
  } = playgroundStore.getState();

  const tasks = instances.flatMap((instance, position) =>
    instanceIds != null && !instanceIds.includes(instance.id)
      ? []
      : [
          getExperimentTaskInput({
            playgroundStore,
            credentials,
            datasetId,
            evaluatorMappings,
            instance,
            position,
          }),
        ]
  );

  if (tasks.length === 0) {
    throw new Error("Select a task to run.");
  }

  return {
    datasetId,
    splitIds: splitIds ?? null,
    repetitions,
    maxConcurrency:
      stateByDatasetId[datasetId]?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    credentials: toGqlCredentials(credentials),
    experimentName: resolveNextExperimentField(
      nextExperimentScaffold?.name,
      stateByDatasetId[datasetId]?.experimentName
    ),
    experimentDescription: resolveNextExperimentField(
      nextExperimentScaffold?.description,
      stateByDatasetId[datasetId]?.experimentDescription
    ),
    experimentMetadata: nextExperimentScaffold?.metadata ?? null,
    // A row run is a spot check: never recorded, whatever the Record switch
    // says, so the column keeps its recorded experiment.
    createEphemeralExperiment: !recordExperiments || runExampleIds != null,
    exampleIds: runExampleIds ?? null,
    tasks,
  };
}

function getExperimentTaskInput({
  playgroundStore,
  credentials,
  datasetId,
  evaluatorMappings,
  instance,
  position,
}: {
  playgroundStore: PlaygroundStore;
  credentials: CredentialsState;
  datasetId: string;
  evaluatorMappings: PlaygroundEvaluatorMappings;
  instance: PlaygroundNormalizedInstance;
  position: number;
}): ExperimentTaskInput {
  const evaluator = getPlaygroundEvaluatorTask(instance);

  if (isDecisionInstance(instance)) {
    return {
      decision: getDecisionTaskInput({
        playgroundStore,
        credentials,
        datasetId,
        evaluatorMappings,
        instance,
      }),
    };
  }

  if (!evaluator) {
    return {
      prompt: getPromptTaskInput({
        playgroundStore,
        instanceId: instance.id,
        credentials,
        datasetId,
        evaluatorMappings,
      }),
    };
  }

  // Always inline: the task is a draft even when it was loaded from a saved
  // evaluator, and what runs must be what the editor shows.
  return {
    evaluator: {
      evaluator: getEvaluatorTaskPreview({
        evaluator,
        name: getEvaluatorTaskName(evaluator, position),
        playgroundStore,
        instanceId: instance.id,
        datasetId,
      }),
      inputMapping: evaluator.inputMapping,
      // Where the task came from, kept on the experiment so the calibration
      // can be traced back to the evaluator it was for.
      source: {
        evaluatorId: evaluator.source.evaluatorId,
        promptVersionId: instance.prompt?.version ?? null,
        datasetEvaluatorId: evaluator.source.datasetEvaluatorId,
        projectEvaluatorId: evaluator.source.projectEvaluatorId,
      },
    },
  };
}

/**
 * The decision task a dataset run creates an experiment for, the decision
 * counterpart of a prompt task: the instance's decision copied as written,
 * where each example's input values are read (the prompt tasks' template
 * variables path), the connection, and the dataset evaluators that score its
 * answers.
 */
function getDecisionTaskInput({
  playgroundStore,
  credentials,
  datasetId,
  evaluatorMappings,
  instance,
}: {
  playgroundStore: PlaygroundStore;
  credentials: CredentialsState;
  datasetId: string;
  evaluatorMappings: PlaygroundEvaluatorMappings;
  instance: PlaygroundNormalizedInstance;
}): DecisionTaskInput {
  const { templateFormat, stateByDatasetId } = playgroundStore.getState();
  if (!instance.decisionRequest) {
    throw new Error("The decision instance has no request.");
  }
  const definition = buildDecisionTaskDefinition({
    draft: instance.decisionRequest,
    templateFormat,
  });
  const providerCredentials = credentials[instance.model.provider] ?? {};
  return {
    ...definition,
    connection: buildDecisionConnection({
      provider: instance.model.provider,
      baseUrl: instance.model.baseUrl,
      customProvider: instance.model.customProvider,
      credentials: Object.entries(providerCredentials).flatMap(
        ([envVarName, value]) =>
          typeof value === "string" && value ? [{ envVarName, value }] : []
      ),
    }),
    modelName: instance.model.modelName ?? "",
    // Recorded, not read, as a prompt task's promptVersionId: the definition
    // above is what runs, edits included.
    decisionVersionId: instance.decision?.versionId ?? null,
    inputValuesPath:
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId,
        mode: "task",
      }) ?? "",
    evaluators: Object.entries(evaluatorMappings).map(
      ([datasetEvaluatorId, { name, inputMapping }]) => ({
        id: datasetEvaluatorId,
        name,
        inputMapping,
      })
    ),
  };
}
