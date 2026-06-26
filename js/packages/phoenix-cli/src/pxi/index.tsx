#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import { getExitCodeForError } from "../exitCodes";
import { writeError } from "../io";
import { PxiApp } from "./App";
import { parsePxiRuntimeOptions } from "./options";
import { runPxiModelPreflight } from "./preflight";

/**
 * Entry point for the `pxi` command.
 *
 * Parses CLI flags into runtime options, runs the model preflight (verifying
 * the chosen provider/model is available and credentialed on the Phoenix
 * server) before anything is drawn, then mounts the Ink chat UI and blocks
 * until the user exits. Preflight runs first so configuration problems surface
 * as a clean error instead of a half-rendered terminal.
 */
export async function main({
  argv = process.argv,
}: {
  argv?: string[];
} = {}): Promise<void> {
  const options = await parsePxiRuntimeOptions({ argv });
  await runPxiModelPreflight({ options });
  const instance = render(<PxiApp options={options} />);
  await instance.waitUntilExit();
}

void main().catch((error) => {
  writeError({
    message: `Error: ${error instanceof Error ? error.message : String(error)}`,
  });
  process.exit(getExitCodeForError(error));
});
