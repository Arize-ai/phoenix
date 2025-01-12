/**
 * Phoenix Prompt Hub Optimizer Flow
 *
 * This diagram illustrates the optimization process for prompts in the Phoenix system:
 *
 * 1. Initial dataset creation with inputs and desired outputs
 * 2. Dataset and prompt ID are fed into the optimizer
 * 3. Optimizer sends prompt + input to LLM
 * 4. System collects outputs that don't match expectations
 * 5. Optimization loop begins:
 *    - Optimizer adjusts prompt to address failed outputs
 *    - Generator posts updated prompt versions to Phoenix
 *    - Process repeats until either:
 *      a) All outputs are satisfied (prompt tagged as "optimized")
 *      b) Turn limit reached (prompt tagged as "partially optimized")
 *
 * The optimization process runs in a cycle until one of two conditions is met,
 * resulting in appropriate tagging of the prompt's optimization status in the
 * Phoenix system.
 */

import invariant from "tiny-invariant";
import { createClient, PhoenixClient } from "../client";
import { runExperiment } from "../experiments";
import { Dataset, Example } from "../types/datasets";
import {
  EvaluationResult,
  Evaluator,
  ExperimentEvaluationRun,
  ExperimentRun,
  TaskOutput,
} from "../types/experiments";
import { Logger } from "../types/logger";
import { getDatasetLike } from "../utils/getDatasetLike";
import { noopLogger } from "../utils/noopLogger";
import {
  optimizationApplySuggestionsPromptTemplater,
  optimizationPromptTemplater,
} from "./prompts";

import OpenAI from "openai";

const openai = new OpenAI({
  // baseURL: "http://localhost:11434/v1",
  // apiKey: "ollama",
});
const model = "gpt-4o";

/**
 * @deprecated use Prompt from client instead
 */
export type Prompt = {
  id: string;
  content: string;
};

const DEFAULT_OPTIONS = {
  maxTurns: 3,
} satisfies OptimizePromptOptions;

export type OptimizePromptOptions = {
  maxTurns?: number;
  verbose?: boolean;
};

export type OptimizePromptHandlers = Partial<{
  onStart: (args: {
    /**
     * The parameters to be used in the optimization, after validation and defaults are applied
     **/
    params: ResolvedOptimizePromptParams;
  }) => void;
  onEnd: (args: { optimized: boolean }) => void;
  onTurnStart: (args: {
    /**
     * The starting prompt that was used in the turn
     **/
    prompt: Prompt;
    /**
     * The dataset that was used in the turn
     **/
    dataset: Dataset;
  }) => void;
  onTurnEnd: (args: {
    /**
     * The prompt after the turn optimizations have been applied
     **/
    prompt: Prompt;
    /**
     * The suggestions that were applied to the prompt
     **/
    suggestions: string[];
    /**
     * The number of failed experiment evaluation runs after the turn
     **/
    failedExperimentEvaluationRunCount: number;
  }) => void;
  onSuccess: (args: { prompt: Prompt }) => void;
  onError: (args: { error: Error }) => void;
}>;

/**
 * A task that accepts some prompt content, an example, and returns a result.
 *
 * The task can be anything, but is expected to be some LLM call that can leverage a single string of
 * prompt content somewhere within its parameters, and produce a result.
 *
 * @example
 * ```ts
 * const task = ({ example, promptContent }: { example: Example; promptContent: string }) => {
 *   const result = await llm.call({
 *     messages: [
 *       { role: "system", content: promptContent },
 *       { role: "user", content: example.input },
 *     ],
 *   });
 *   return {
 *     success: result.output === example.output,
 *     output: result.output,
 *   };
 * };
 * ```
 */
export type OptimizePromptTask = {
  description: string;
  execute: (args: {
    example: Example;
    promptContent: string;
  }) => Promise<TaskOutput> | TaskOutput;
};

export type OptimizePromptParams = {
  prompt: { id: string } | { content: string };
  dataset: Dataset | string | Example[];
  client?: PhoenixClient;
  options?: OptimizePromptOptions;
  task: OptimizePromptTask;
  evaluator: Evaluator;
  handlers?: OptimizePromptHandlers;
  logger?: Logger;
};

export type ResolvedOptimizePromptParams = {
  prompt: Prompt;
  client: PhoenixClient;
  logger: Logger;
  dataset: Dataset;
  options: OptimizePromptOptions;
} & Omit<
  OptimizePromptParams,
  "client" | "logger" | "dataset" | "options" | "prompt"
>;

const getParamsWithDefaults = async (params: OptimizePromptParams) => {
  const client = params.client ?? createClient();
  const logger = params.logger ?? console;
  const dataset = await getDatasetLike({ dataset: params.dataset, client });
  // TODO: implement getPromptLike
  // fetch prompt from client, or, create a new prompt
  const prompt =
    "id" in params.prompt
      ? { id: params.prompt.id, content: "" }
      : { content: params.prompt.content, id: id() };
  return {
    ...params,
    prompt,
    client,
    logger,
    dataset,
    options: {
      ...DEFAULT_OPTIONS,
      ...params.options,
    },
  } satisfies ResolvedOptimizePromptParams;
};

export async function optimizePrompt(params: OptimizePromptParams) {
  const paramsWithDefaults = await getParamsWithDefaults(params);
  const { handlers } = paramsWithDefaults;
  const { logger, dataset, options, prompt, client } = paramsWithDefaults;
  logger.info(`Optimizing prompt ${prompt.id} with dataset ${dataset.id}`);
  logger.info(`Checking prompt ${prompt.id} against dataset ${dataset.id}`);
  // evaluate the task outputs against the dataset's expected outputs
  const { experiment, failedExperimentEvaluationRuns, needsOptimization } =
    await evaluatePrompt({
      promptContent: prompt.content,
      dataset,
      task: params.task,
      evaluator: params.evaluator,
      client,
      logger,
      verbose: options.verbose,
    });

  if (!experiment.evaluationRuns) {
    logger.error("Experiment runs not found. Cannot optimize prompt.");
    return;
  }

  if (!needsOptimization) {
    logger.info(
      `Prompt ${prompt.id} does not need optimization, and passes all evaluations.\nExtend your dataset with more examples that could use optimization.`
    );
    handlers?.onEnd?.({ optimized: false });
    return;
  }

  // if all outputs are not satisfied, continue
  logger.info(
    `${failedExperimentEvaluationRuns.length} outputs failed evaluation`
  );
  logger.info(`Prompt ${prompt.id} can be optimized, starting optimization`);
  handlers?.onStart?.({ params: paramsWithDefaults });

  let lastPromptContent = prompt.content;
  let lastFailedExperimentRuns = experiment.runs;
  let lastFailedExperimentEvaluationRuns = failedExperimentEvaluationRuns;
  let success = false;
  let turn = 0;
  while (turn < options.maxTurns) {
    turn++;
    logger.info(`Turn ${turn} of ${options.maxTurns}`);
    handlers?.onTurnStart?.({ prompt, dataset });
    // generate new prompt for turn
    const { newPromptContent, suggestions } = await runTurn({
      promptContent: lastPromptContent,
      task: params.task,
      evaluator: params.evaluator,
      lastFailedExperimentRuns: lastFailedExperimentRuns,
      lastFailedExperimentEvaluationRuns: lastFailedExperimentEvaluationRuns,
      dataset,
    });
    // run new experiment with new prompt
    const {
      experiment: newExperiment,
      failedExperimentEvaluationRuns: newFailedExperimentEvaluationRuns,
    } = await evaluatePrompt({
      promptContent: newPromptContent,
      dataset,
      task: params.task,
      evaluator: params.evaluator,
      client,
      logger,
    });
    lastFailedExperimentRuns = newExperiment.runs;
    lastFailedExperimentEvaluationRuns = newFailedExperimentEvaluationRuns;
    // update prompt
    lastPromptContent = newPromptContent;
    logger.info(`Turn ${turn} complete`);
    handlers?.onTurnEnd?.({
      prompt: { content: lastPromptContent, id: prompt.id },
      suggestions,
      failedExperimentEvaluationRunCount:
        newFailedExperimentEvaluationRuns.length,
    });

    if (newFailedExperimentEvaluationRuns.length === 0) {
      logger.info(`Prompt ${prompt.id} optimized before max turns`);
      success = true;
      break;
    }
  }

  const lastTestedInputOutputs =
    lastFailedExperimentEvaluationRuns
      ?.map((run) => {
        try {
          const experimentRun = lastFailedExperimentRuns[run.experimentRunId];
          invariant(experimentRun, "Experiment run not found");
          const example = dataset.examples.find(
            (example) => example.id === experimentRun.datasetExampleId
          );
          invariant(example, "Example not found");
          invariant(
            typeof example.input?.input === "string",
            "Example input not found"
          );
          invariant(
            typeof experimentRun.output === "string",
            "Experiment run output not found"
          );
          return {
            input: example.input.input,
            output: experimentRun.output,
            score: run.result?.score,
            explanation: run.result?.explanation,
          };
        } catch {
          return null;
        }
      })
      .filter((i) => i != null) ?? [];

  if (success) {
    handlers?.onSuccess?.({
      prompt: { content: lastPromptContent, id: prompt.id },
    });
  } else {
    logger.info(`Prompt ${prompt.id} did not optimize before max turns`);
  }
  handlers?.onEnd?.({ optimized: success });
  return {
    initialPrompt: prompt,
    optimizedPrompt: { content: lastPromptContent, id: prompt.id },
    lastTestedInputOutputs,
  };
}

async function evaluatePrompt(params: {
  promptContent: string;
  dataset: Dataset;
  task: OptimizePromptTask;
  evaluator: Evaluator;
  client: PhoenixClient;
  logger: Logger;
  verbose?: boolean;
}) {
  const { promptContent, dataset, task, evaluator, client, logger, verbose } =
    params;
  const experiment = await runExperiment({
    dataset,
    task: (example) => task.execute({ example, promptContent }),
    evaluators: [evaluator],
    client,
    logger: verbose ? logger : noopLogger,
    readonly: true,
  });
  invariant(experiment.evaluationRuns, "Experiment runs not found");
  invariant(
    !experiment.evaluationRuns.some((run) => run.error),
    "Experiment runs contain errors\n" +
      JSON.stringify(experiment.evaluationRuns, null, 2)
  );
  const failedExperimentEvaluationRuns = experiment.evaluationRuns.filter(
    (run) =>
      run.result != null && (run.result.score == null || run.result.score < 1)
  );
  const needsOptimization = failedExperimentEvaluationRuns.length > 0;

  return {
    experiment,
    failedExperimentEvaluationRuns,
    needsOptimization,
  };
}

/**
 * Run a single turn of the optimization loop.
 */
async function runTurn(params: {
  promptContent: string;
  task: OptimizePromptTask;
  evaluator: Evaluator;
  lastFailedExperimentRuns: Record<string, ExperimentRun>;
  lastFailedExperimentEvaluationRuns: ExperimentEvaluationRun[];
  dataset: Dataset;
}) {
  const {
    promptContent,
    task,
    lastFailedExperimentEvaluationRuns,
    lastFailedExperimentRuns,
    dataset,
  } = params;
  // collect suggestions for each failed evaluation run
  const suggestions: string[] = [];
  for (const failedExperimentEvaluationRun of lastFailedExperimentEvaluationRuns) {
    invariant(
      failedExperimentEvaluationRun.result,
      "Evaluation result not found"
    );
    const exampleId =
      lastFailedExperimentRuns[failedExperimentEvaluationRun.experimentRunId]
        ?.datasetExampleId;
    invariant(exampleId, "Example ID not found");
    const incorrectOutput =
      lastFailedExperimentRuns[failedExperimentEvaluationRun.experimentRunId]
        ?.output;
    invariant(
      typeof incorrectOutput === "string",
      "Incorrect output not found"
    );
    const example = dataset.examples.find(
      (example) => example.id === exampleId
    );
    invariant(example, "Example not found");
    invariant(
      typeof example.input?.input === "string",
      "Example input not found"
    );
    invariant(
      typeof example.output?.output === "string",
      "Example output not found"
    );
    const optimizedPromptSuggestion = await generateSuggestion({
      promptContent,
      evaluationResult: failedExperimentEvaluationRun.result,
      taskDescription: task.description,
      input: example.input.input,
      incorrectOutput: incorrectOutput,
      expectedOutput: example.output.output,
    });
    suggestions.push(optimizedPromptSuggestion);
  }
  // synthesize old prompt + suggestions into a new prompt
  const newPromptContent = await generatePromptFromSuggestions({
    oldPromptContent: promptContent,
    suggestions,
  });

  return { newPromptContent, suggestions };
}

async function generateSuggestion(params: {
  promptContent: string;
  taskDescription: string;
  input: string;
  incorrectOutput: string;
  expectedOutput: string;
  evaluationResult: EvaluationResult;
}) {
  const {
    promptContent,
    taskDescription,
    input,
    incorrectOutput,
    expectedOutput,
    evaluationResult,
  } = params;
  const optimizerText = optimizationPromptTemplater({
    task: taskDescription,
    instruction: promptContent,
    input,
    incorrectOutput,
    expectedOutput,
    failureReason: evaluationResult.explanation ?? "No failure reason provided",
  });
  const optimizedPromptContent = await openai.chat.completions
    .create({
      model,
      messages: [{ role: "user", content: optimizerText }],
    })
    ?.then((res) => res.choices?.[0]?.message?.content);
  invariant(optimizedPromptContent, "Optimized prompt content not found");
  return optimizedPromptContent;
}

async function generatePromptFromSuggestions(params: {
  oldPromptContent: string;
  suggestions: string[];
}) {
  const { oldPromptContent, suggestions } = params;
  const synthesisPromptContent = optimizationApplySuggestionsPromptTemplater({
    suggestions,
    instruction: oldPromptContent,
  });
  const newPromptContent = await openai.chat.completions
    .create({
      model,
      messages: [{ role: "user", content: synthesisPromptContent }],
    })
    ?.then((res) => res.choices?.[0]?.message?.content);
  invariant(newPromptContent, "New prompt content not found");
  return newPromptContent;
}

let _id = 2000;

/**
 * Generate a unique id.
 *
 * @deprecated Use id generated by phoenix instead.
 * @returns A unique id.
 */
export function id(): string {
  return (() => {
    _id++;
    return _id.toString();
  })();
}
