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
  // Ink's kitty-keyboard "auto" detection writes a `CSI ? u` capability query to
  // stdout from its constructor, before it switches the terminal into raw mode.
  // On a TTY still in canonical mode the terminal echoes its reply (`ESC[?0u`)
  // back to the screen, leaving a stray `^[[?0u` line above the banner. Putting
  // stdin into raw mode here disables that echo so Ink consumes the reply
  // silently; Ink keeps raw mode on for the rest of the session.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  const instance = render(<PxiApp options={options} />, {
    exitOnCtrlC: false,
    kittyKeyboard: {
      mode: "auto",
      flags: ["disambiguateEscapeCodes"],
    },
  });
  await instance.waitUntilExit();
}

void main().catch((error) => {
  writeError({
    message: `Error: ${error instanceof Error ? error.message : String(error)}`,
  });
  process.exit(getExitCodeForError(error));
});
