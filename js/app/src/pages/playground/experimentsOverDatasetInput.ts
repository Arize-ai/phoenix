import type { CredentialsState } from "@phoenix/store/credentialsStore";
import type {
  PlaygroundNormalizedInstance,
  PlaygroundStore,
} from "@phoenix/store/playground";
import {
  DEFAULT_MAX_CONCURRENCY,
  getPlaygroundEvaluatorTask,
} from "@phoenix/store/playground";

import type {
  EvaluatorInputMappingInput,
  ExperimentsOverDatasetInput,
  ExperimentTaskInput,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
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
