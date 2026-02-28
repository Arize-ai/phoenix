#!/usr/bin/env node

import { Command } from "commander";

import {
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

// Phoenix CLI Main Logic
export function main() {
  const program = new Command();

  program
    .name("px")
    .description("Phoenix CLI - AI observability from the command line")
    .version("0.0.4");

  // Register commands
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

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.help();
  }

  program.parse();
}
