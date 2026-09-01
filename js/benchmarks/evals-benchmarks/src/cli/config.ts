import { readdirSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_EVAL_MODEL } from "../resolveEvalModel.js";

export const DEFAULT_PROMPT_TECHNIQUE = "default";
export const DEFAULT_DATA_FORMAT = "default";

const EVAL_FILE_SUFFIX = ".eval.ts";

export class SweepCliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "SweepCliError";
    this.exitCode = exitCode;
  }
}

export const SWEEP_HELP = `Usage:
  pnpm --filter evals-benchmarks sweep -- --evaluator <id> [options]

Run eval-library benchmarks as Phoenix experiments. Each --models value is one
experiment on the same dataset (sequential Vitest runs). --prompts and --formats
are still single-value only; omit them to use the baked-in prompt and format.

Options:
  --evaluator <id>   Required. Benchmark id (filename without ${EVAL_FILE_SUFFIX}).
  --models <list>    Comma-separated judge models (default: EVAL_MODEL or gpt-4o-mini).
                     Use provider:model when the id is ambiguous (e.g. anthropic:claude-sonnet-4-5).
  --prompts <list>   Prompt techniques (reserved; at most one value).
  --formats <list>   Data formats (reserved; at most one value).
  -h, --help         Show this help.

Examples:
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --models gpt-4o-mini,gpt-4o
`;

export type SweepCliFlags = {
  help: boolean;
  evaluator?: string;
  models?: string;
  prompts?: string;
  formats?: string;
};

export type SweepCoordinates = {
  model: string;
  promptTechnique: string;
  dataFormat: string;
};

export type SweepPlan = {
  evaluator: string;
  evalFile: string;
  coordinates: SweepCoordinates;
  experimentName: string;
  experimentMetadata: SweepCoordinates;
};

/**
 * Split a comma-separated flag into trimmed non-empty tokens.
 */
export function splitCsvList(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * List benchmark ids from `*.eval.ts` files in `srcDir`.
 */
export function listEvaluators({ srcDir }: { srcDir: string }): string[] {
  return readdirSync(srcDir)
    .filter((fileName) => fileName.endsWith(EVAL_FILE_SUFFIX))
    .map((fileName) => fileName.slice(0, -EVAL_FILE_SUFFIX.length))
    .sort();
}

/**
 * Resolve `--evaluator` to a path relative to the package root (`src/<id>.eval.ts`).
 */
export function resolveEvalFile({
  evaluator,
  srcDir,
}: {
  evaluator: string;
  srcDir: string;
}): string {
  const known = listEvaluators({ srcDir });
  if (!known.includes(evaluator)) {
    throw new SweepCliError(
      `Unknown evaluator ${JSON.stringify(evaluator)}. Known: ${known.join(", ")}`
    );
  }
  return join("src", `${evaluator}${EVAL_FILE_SUFFIX}`);
}

/**
 * Prompt and format axes are still single-value. Models may be a list.
 */
export function assertSingleValueAxes({
  prompts,
  formats,
}: {
  prompts: string[];
  formats: string[];
}): void {
  const hasUnimplementedMatrix = prompts.length > 1 || formats.length > 1;
  if (!hasUnimplementedMatrix) {
    return;
  }
  throw new SweepCliError(
    [
      "Prompt and format sweeps are not implemented yet.",
      "Pass at most one value each for --prompts and --formats,",
      "or omit those flags. --models may list multiple judges.",
    ].join(" ")
  );
}

/**
 * Coordinates for one sweep cell. Prompt/format stay at the baked-in default.
 */
export function buildSweepCoordinates({
  evalModelName = process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL,
}: {
  evalModelName?: string;
} = {}): SweepCoordinates {
  return {
    model: evalModelName,
    promptTechnique: DEFAULT_PROMPT_TECHNIQUE,
    dataFormat: DEFAULT_DATA_FORMAT,
  };
}

/**
 * Experiment title used in Phoenix: evaluator / model / prompt / format.
 */
export function buildExperimentName({
  evaluator,
  coordinates,
}: {
  evaluator: string;
  coordinates: SweepCoordinates;
}): string {
  return `${evaluator} / ${coordinates.model} / ${coordinates.promptTechnique} / ${coordinates.dataFormat}`;
}

/**
 * Env vars the child Vitest process uses for judge model and experiment identity.
 */
export function buildSweepEnv({
  experimentName,
  coordinates,
}: {
  experimentName: string;
  coordinates: SweepCoordinates;
}): Record<string, string> {
  return {
    EVAL_MODEL: coordinates.model,
    PHOENIX_EXPERIMENT_NAME: experimentName,
    PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
  };
}

function buildPlanForModel({
  evaluator,
  evalFile,
  evalModelName,
}: {
  evaluator: string;
  evalFile: string;
  evalModelName: string;
}): SweepPlan {
  const coordinates = buildSweepCoordinates({ evalModelName });
  const experimentName = buildExperimentName({ evaluator, coordinates });
  return {
    evaluator,
    evalFile,
    coordinates,
    experimentName,
    experimentMetadata: coordinates,
  };
}

/**
 * Build one sweep cell per judge model from CLI flags.
 */
export function resolveSweepPlans({
  flags,
  srcDir,
  evalModelName = process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL,
}: {
  flags: SweepCliFlags;
  srcDir: string;
  evalModelName?: string;
}): SweepPlan[] {
  if (flags.help) {
    throw new SweepCliError(SWEEP_HELP, 0);
  }
  const evaluator = flags.evaluator?.trim();
  if (!evaluator) {
    throw new SweepCliError(`Missing required --evaluator.\n\n${SWEEP_HELP}`);
  }
  const models = splitCsvList(flags.models);
  assertSingleValueAxes({
    prompts: splitCsvList(flags.prompts),
    formats: splitCsvList(flags.formats),
  });
  const evalFile = resolveEvalFile({ evaluator, srcDir });
  const modelNames = models.length > 0 ? models : [evalModelName];
  return modelNames.map((modelName) =>
    buildPlanForModel({ evaluator, evalFile, evalModelName: modelName })
  );
}
