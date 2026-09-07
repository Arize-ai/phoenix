/**
 * Eval-library benchmark sweep entry point.
 *
 * Each model × prompt × format cell is one Vitest process / Phoenix experiment
 * on the same dataset.
 *
 *   pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --formats default,json,messages
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
  /* step 1: parse arguments */
  const flags = parseSweepArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(SWEEP_HELP);
    return;
  }
  /* step 2: get the list of plans to execute */
  const plans = resolveSweepPlans({ flags, srcDir });
  let failed = false;
  for (const plan of plans) {
    /* step 3: build the environment variables for the child process */
    const sweepEnv = buildSweepEnv({
      experimentName: plan.experimentName,
      coordinates: plan.coordinates,
    });
    /* step 4: run the child process */
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
