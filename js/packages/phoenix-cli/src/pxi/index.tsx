#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import { getExitCodeForError } from "../exitCodes";
import { writeError } from "../io";
import { PxiApp } from "./App";
import { parsePxiRuntimeOptions } from "./options";
import { runPxiModelPreflight } from "./preflight";

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
