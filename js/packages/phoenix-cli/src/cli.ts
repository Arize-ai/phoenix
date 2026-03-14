#!/usr/bin/env node

import { Command } from "commander";

import { printBanner } from "./banner";
import {
  createAnnotationConfigCommand,
  createApiCommand,
  createAuthCommand,
  createDatasetCommand,
  createDatasetsCommand,
  createExperimentCommand,
  createExperimentsCommand,
  createProjectsCommand,
  createPromptCommand,
  createPromptsCommand,
  createSessionCommand,
  createSessionsCommand,
  createTraceCommand,
  createTracesCommand,
} from "./commands";
import { VERSION } from "./version";

// Phoenix CLI Main Logic
export function main() {
  const program = new Command();

  program.name("px").version(VERSION);

  // Register commands
  program.addCommand(createAnnotationConfigCommand());
  program.addCommand(createAuthCommand());
  program.addCommand(createProjectsCommand());
  program.addCommand(createTracesCommand());
  program.addCommand(createTraceCommand());
  program.addCommand(createDatasetsCommand());
  program.addCommand(createDatasetCommand());
  program.addCommand(createSessionsCommand());
  program.addCommand(createSessionCommand());
  program.addCommand(createExperimentsCommand());
  program.addCommand(createExperimentCommand());
  program.addCommand(createPromptsCommand());
  program.addCommand(createPromptCommand());
  program.addCommand(createApiCommand());

  // Show banner and help if no command provided
  if (process.argv.length === 2) {
    printBanner();
    program.help();
  }

  program.parse();
}
