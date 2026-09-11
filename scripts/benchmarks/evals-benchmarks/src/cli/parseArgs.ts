import { parseArgs } from "node:util";

import { SweepCliError, SWEEP_HELP, type SweepCliFlags } from "./config.js";

/**
 * Parse `sweep` argv (without the node + script path).
 *
 * A leading `--` is ignored so both
 * `pnpm sweep -- --evaluator toxicity` and `pnpm sweep --evaluator toxicity`
 * work, depending on whether the package manager forwards the separator.
 */
export function parseSweepArgs(args: string[]): SweepCliFlags {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  try {
    const { values } = parseArgs({
      args: normalized,
      options: {
        evaluator: { type: "string" },
        models: { type: "string" },
        prompts: { type: "string" },
        formats: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    return {
      help: values.help === true,
      evaluator: values.evaluator,
      models: values.models,
      prompts: values.prompts,
      formats: values.formats,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SweepCliError(`${message}\n\n${SWEEP_HELP}`);
  }
}
