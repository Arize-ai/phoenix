#!/usr/bin/env node

import { Command } from "commander";

import { printBanner } from "./banner";
import {
  createAnnotationConfigCommand,
  createApiCommand,
  createAuthCommand,
  createDatasetCommand,
  createDatasetsCommand,
  createDocsCommand,
  createExperimentCommand,
  createExperimentsCommand,
  createProjectsCommand,
  createPromptCommand,
  createPromptsCommand,
  createSessionCommand,
  createSessionsCommand,
  createSpansCommand,
  createTraceCommand,
  createTracesCommand,
} from "./commands";

// Phoenix CLI Main Logic
export function main() {
  const program = new Command();

  program.name("px");
  program.enablePositionalOptions();

  // Register commands
  program.addCommand(createAnnotationConfigCommand());
  program.addCommand(createAuthCommand());
  program.addCommand(createProjectsCommand());
  program.addCommand(createTracesCommand());
  program.addCommand(createTraceCommand());
  program.addCommand(createSpansCommand());
  program.addCommand(createDatasetsCommand());
  program.addCommand(createDatasetCommand());
  program.addCommand(createSessionsCommand());
  program.addCommand(createSessionCommand());
  program.addCommand(createExperimentsCommand());
  program.addCommand(createExperimentCommand());
  program.addCommand(createPromptsCommand());
  program.addCommand(createPromptCommand());
  program.addCommand(createApiCommand());
  program.addCommand(createDocsCommand());

  // Show banner and help if no command provided
  if (process.argv.length === 2) {
    printBanner();
    program.help();
  }

  program.parse();
}
