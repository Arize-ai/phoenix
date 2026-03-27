#!/usr/bin/env node

import { Command } from "commander";

import { printBanner } from "./banner";
import {
  createAnnotationConfigCommand,
  createApiCommand,
  createAuthCommand,
  createDatasetCommand,
  createDocsCommand,
  createExperimentCommand,
  createProjectCommand,
  createPromptCommand,
  createSessionCommand,
  createSelfCommand,
  createSpanCommand,
  createTraceCommand,
} from "./commands";
import { CLI_VERSION } from "./version";

export function createProgram(): Command {
  const program = new Command();

  program.name("px");
  program.enablePositionalOptions();
  program.version(CLI_VERSION);

  // Register commands
  program.addCommand(createAnnotationConfigCommand());
  program.addCommand(createAuthCommand());
  program.addCommand(createProjectCommand());
  program.addCommand(createTraceCommand());
  program.addCommand(createSpanCommand());
  program.addCommand(createDatasetCommand());
  program.addCommand(createSessionCommand());
  program.addCommand(createExperimentCommand());
  program.addCommand(createPromptCommand());
  program.addCommand(createApiCommand());
  program.addCommand(createDocsCommand());
  program.addCommand(createSelfCommand());

  return program;
}

// Phoenix CLI Main Logic
export async function main({
  argv = process.argv,
}: {
  argv?: string[];
} = {}): Promise<void> {
  const program = createProgram();

  // Show banner and help if no command provided
  if (argv.length === 2) {
    await printBanner();
    program.help();
    return;
  }

  await program.parseAsync(argv);
}
