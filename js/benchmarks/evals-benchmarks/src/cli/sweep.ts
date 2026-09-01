/**
 * Eval-library benchmark sweep entry point.
 *
 * Each --models value is one Vitest process / Phoenix experiment on the same
 * dataset. Prompt and format stay at the baked-in defaults.
 *
 *   pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --models gpt-4o-mini,gpt-4o
 */
import { spawn } from "node:child_process";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSweepEnv,
  resolveSweepPlans,
  SweepCliError,
  SWEEP_HELP,
} from "./config.js";
import { parseSweepArgs } from "./parseArgs.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const srcDir = fileURLToPath(new URL("../", import.meta.url));

function runVitest({
  evalFile,
  env,
}: {
  evalFile: string;
  env: NodeJS.ProcessEnv;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "vitest",
      ["run", "--config", "phoenix.vitest.config.ts", evalFile],
      {
        cwd: packageRoot,
        env: {
          ...env,
          PATH: [
            join(packageRoot, "node_modules", ".bin"),
            join(packageRoot, "..", "..", "node_modules", ".bin"),
            env.PATH ?? process.env.PATH ?? "",
          ].join(delimiter),
        },
        stdio: "inherit",
      }
    );
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const flags = parseSweepArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(SWEEP_HELP);
    return;
  }
  const plans = resolveSweepPlans({ flags, srcDir });
  let failed = false;
  for (const plan of plans) {
    const sweepEnv = buildSweepEnv({
      experimentName: plan.experimentName,
      coordinates: plan.coordinates,
    });
    const exitCode = await runVitest({
      evalFile: plan.evalFile,
      env: { ...process.env, ...sweepEnv },
    });
    if (exitCode !== 0) {
      failed = true;
    }
  }
  if (failed) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  if (err instanceof SweepCliError) {
    const stream = err.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(`${err.message}\n`);
    process.exitCode = err.exitCode;
  } else {
    throw err;
  }
}
