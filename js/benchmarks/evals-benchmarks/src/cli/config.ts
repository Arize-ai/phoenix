import { readdirSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_EVAL_MODEL } from "../resolveEvalModel.js";

export const DEFAULT_PROMPT_TECHNIQUE = "default";
export const DEFAULT_DATA_FORMAT = "default";
export const FEW_SHOT_PROMPT_TECHNIQUE = "few-shot";

const EVAL_FILE_SUFFIX = ".eval.ts";

/** Techniques available for every evaluator. Extra techniques are per-evaluator. */
const UNIVERSAL_PROMPT_TECHNIQUES = [DEFAULT_PROMPT_TECHNIQUE] as const;

const EXTRA_PROMPT_TECHNIQUES: Partial<Record<string, readonly string[]>> = {
  toxicity: [FEW_SHOT_PROMPT_TECHNIQUE],
};

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

Run eval-library benchmarks as Phoenix experiments. Each model × prompt cell is
one experiment on the same dataset (sequential Vitest runs). --formats is still
single-value only; omit it to use the baked-in format.

Options:
  --evaluator <id>   Required. Benchmark id (filename without ${EVAL_FILE_SUFFIX}).
  --models <list>    Comma-separated judge models (default: EVAL_MODEL or gpt-4o-mini).
                     Use provider:model when the id is ambiguous (e.g. anthropic:claude-sonnet-4-5).
  --prompts <list>   Prompt techniques (default: default). default is always valid;
                     few-shot is currently only implemented for toxicity.
  --formats <list>   Data formats (reserved; at most one value).
  -h, --help         Show this help.

Examples:
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --models gpt-4o-mini,gpt-4o
  pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --prompts default,few-shot
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
 * Prompt techniques implemented for an evaluator (`default` plus extras).
 */
export function listPromptTechniques({
  evaluator,
}: {
  evaluator: string;
}): string[] {
  const extras = EXTRA_PROMPT_TECHNIQUES[evaluator] ?? [];
  return [...UNIVERSAL_PROMPT_TECHNIQUES, ...extras];
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
 * Format axis is still single-value.
 */
export function assertSingleValueAxes({
  formats,
}: {
  formats: string[];
}): void {
  if (formats.length <= 1) {
    return;
  }
  throw new SweepCliError(
    [
      "Format sweeps are not implemented yet.",
      "Pass at most one value for --formats, or omit the flag.",
      "--models and --prompts may list multiple values.",
    ].join(" ")
  );
}

/**
 * Reject unknown or unimplemented prompt techniques for this evaluator.
 */
export function assertPromptTechniques({
  evaluator,
  prompts,
}: {
  evaluator: string;
  prompts: string[];
}): void {
  const allowed = listPromptTechniques({ evaluator });
  const unknown = prompts.filter((technique) => !allowed.includes(technique));
  if (unknown.length === 0) {
    return;
  }
  throw new SweepCliError(
    [
      `Unsupported prompt technique(s) for ${JSON.stringify(evaluator)}: ${unknown.join(", ")}.`,
      `Known for this evaluator: ${allowed.join(", ")}.`,
    ].join(" ")
  );
}

/**
 * Coordinates for one sweep cell. Format stays at the baked-in default.
 */
export function buildSweepCoordinates({
  evalModelName = process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL,
  promptTechnique = DEFAULT_PROMPT_TECHNIQUE,
}: {
  evalModelName?: string;
  promptTechnique?: string;
} = {}): SweepCoordinates {
  return {
    model: evalModelName,
    promptTechnique,
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
 * Env vars the child Vitest process uses for judge model, prompt, and experiment identity.
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
    EVAL_PROMPT_TECHNIQUE: coordinates.promptTechnique,
    PHOENIX_EXPERIMENT_NAME: experimentName,
    PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
  };
}

function buildPlanForCell({
  evaluator,
  evalFile,
  evalModelName,
  promptTechnique,
}: {
  evaluator: string;
  evalFile: string;
  evalModelName: string;
  promptTechnique: string;
}): SweepPlan {
  const coordinates = buildSweepCoordinates({
    evalModelName,
    promptTechnique,
  });
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
 * Build one sweep cell per model × prompt combination from CLI flags.
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
  const prompts = splitCsvList(flags.prompts);
  assertSingleValueAxes({
    formats: splitCsvList(flags.formats),
  });
  const evalFile = resolveEvalFile({ evaluator, srcDir });
  assertPromptTechniques({ evaluator, prompts });
  const modelNames = models.length > 0 ? models : [evalModelName];
  const promptTechniques =
    prompts.length > 0 ? prompts : [DEFAULT_PROMPT_TECHNIQUE];
  return modelNames.flatMap((modelName) =>
    promptTechniques.map((promptTechnique) =>
      buildPlanForCell({
        evaluator,
        evalFile,
        evalModelName: modelName,
        promptTechnique,
      })
    )
  );
}
