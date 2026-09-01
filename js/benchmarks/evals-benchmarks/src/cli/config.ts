import { readdirSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_EVAL_MODEL } from "../model.js";

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

Run one eval-library benchmark as a Phoenix experiment, stamped with sweep
coordinates. Tracking is on (same as \`pnpm evals\`). Matrix execution is not
implemented yet: omit --models/--prompts/--formats, or pass a single value
each. Multiple values error instead of silently running one cell.

Options:
  --evaluator <id>   Required. Benchmark id (filename without ${EVAL_FILE_SUFFIX}).
  --models <list>    Comma-separated judge models (reserved; not applied yet).
  --prompts <list>   Comma-separated prompt techniques (reserved; not applied yet).
  --formats <list>   Comma-separated data formats (reserved; not applied yet).
  -h, --help         Show this help.

Example (step 1 — baked-in config only):
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity
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
 * Reject multi-value axis flags until matrix execution exists.
 */
export function assertSingleCellAxes({
  models,
  prompts,
  formats,
}: {
  models: string[];
  prompts: string[];
  formats: string[];
}): void {
  const hasMatrix =
    models.length > 1 || prompts.length > 1 || formats.length > 1;
  if (!hasMatrix) {
    return;
  }
  throw new SweepCliError(
    [
      "Model × prompt × format sweeps are not implemented yet.",
      "Pass at most one value each for --models, --prompts, and --formats,",
      "or omit those flags to run the baked-in evaluator configuration.",
    ].join(" ")
  );
}

/**
 * Coordinates for the baked-in cell. Axis flags are not applied in step 1.
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
 * Env vars the vitest harness reads for experiment identity.
 */
export function buildSweepEnv({
  experimentName,
  coordinates,
}: {
  experimentName: string;
  coordinates: SweepCoordinates;
}): Record<string, string> {
  return {
    PHOENIX_EXPERIMENT_NAME: experimentName,
    PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
  };
}

/**
 * Build the single-cell sweep plan from CLI flags.
 */
export function resolveSweepPlan({
  flags,
  srcDir,
  evalModelName,
}: {
  flags: SweepCliFlags;
  srcDir: string;
  evalModelName?: string;
}): SweepPlan {
  if (flags.help) {
    throw new SweepCliError(SWEEP_HELP, 0);
  }
  const evaluator = flags.evaluator?.trim();
  if (!evaluator) {
    throw new SweepCliError(`Missing required --evaluator.\n\n${SWEEP_HELP}`);
  }
  assertSingleCellAxes({
    models: splitCsvList(flags.models),
    prompts: splitCsvList(flags.prompts),
    formats: splitCsvList(flags.formats),
  });
  const evalFile = resolveEvalFile({ evaluator, srcDir });
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
